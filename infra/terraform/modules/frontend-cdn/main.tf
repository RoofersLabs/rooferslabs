# =============================================================================
# frontend-cdn — S3 (private) + CloudFront + OAC for the Vite SPA
# =============================================================================
# The bucket is never public; CloudFront reads it through an Origin Access
# Control (SigV4). SPA routing is handled by mapping 403/404 → /index.html (200).
# Immutable hashed assets vs. no-cache HTML/service-worker caching is driven by
# the Cache-Control headers set at upload time (see infra/scripts/deploy-web.sh),
# which the cache policy below honors.
#
# CloudFront certificates MUST live in us-east-1 — this module expects an
# aws.us_east_1 aliased provider for the ACM resources.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

locals {
  # Clerk-, Google-Fonts-, PayPal- and API-aware CSP. Clerk production runs on
  # clerk.<root_domain> (CNAME) or *.clerk.accounts.dev; both are allowed.
  #
  # PayPal appears in three directives because the checkout is in-context, not
  # a redirect: the JS SDK script comes from www.paypal.com (sandbox included —
  # the client id, not the host, selects the environment), the buttons and the
  # card form render inside PayPal-owned iframes, and the SDK phones its own
  # APIs from the page. paypalobjects.com serves the SDK's static assets. The
  # redirect fallback needs none of this — the browser simply leaves — so these
  # entries exist purely for the in-context path.
  default_csp = join(" ", [
    "default-src 'self';",
    "base-uri 'self';",
    "object-src 'none';",
    "frame-ancestors 'none';",
    "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.${var.root_domain} https://challenges.cloudflare.com https://www.paypal.com https://www.paypalobjects.com;",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
    "font-src 'self' https://fonts.gstatic.com;",
    "img-src 'self' data: blob: https:;",
    "connect-src 'self' https://${var.api_domain} wss://${var.api_domain} https://*.clerk.accounts.dev https://clerk.${var.root_domain} https://www.paypal.com https://www.sandbox.paypal.com https://api.paypal.com https://api.sandbox.paypal.com;",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://www.paypal.com https://www.sandbox.paypal.com;",
    "worker-src 'self' blob:;",
    "manifest-src 'self';",
    "upgrade-insecure-requests",
  ])
  csp = var.content_security_policy != "" ? var.content_security_policy : local.default_csp
}

# ---- Origin bucket (private) --------------------------------------------------

resource "aws_s3_bucket" "site" {
  bucket        = var.bucket_name
  force_destroy = false
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # SSE-S3: CloudFront OAC reads without KMS grants
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled" # cheap rollback of a bad deploy
  }
}

# ---- Access-logs bucket -------------------------------------------------------

resource "aws_s3_bucket" "logs" {
  bucket        = "${var.bucket_name}-logs"
  force_destroy = true
  tags          = var.tags
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront legacy log delivery writes with ACLs → the bucket owner must accept
# them (BucketOwnerPreferred) rather than the default BucketOwnerEnforced.
resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    id     = "expire-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = var.log_retention_days
    }
  }
}

# ---- Origin Access Control ----------------------------------------------------

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "${var.name}-web-oac"
  description                       = "SigV4 access from CloudFront to the SPA bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---- Cache + response-headers policies ---------------------------------------

# Honor the origin Cache-Control (immutable assets vs. no-cache HTML/SW), forward
# no cookies/headers/query, and compress. min_ttl 0 lets no-cache actually skip.
resource "aws_cloudfront_cache_policy" "this" {
  name        = "${var.name}-web-cache"
  min_ttl     = 0
  default_ttl = 86400
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
    cookies_config { cookie_behavior = "none" }
    headers_config { header_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}

resource "aws_cloudfront_response_headers_policy" "this" {
  name = "${var.name}-web-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
  }
}

# ---- ACM certificate (us-east-1, required by CloudFront) ----------------------

# The certificate's domain list is deliberately NOT `domain_aliases`. Adding a
# SAN replaces the certificate, and a replacement is PENDING_VALIDATION until its
# DNS records exist in Cloudflare — which is a manual step here. Keeping the two
# lists separate lets a new hostname be requested and validated while the
# distribution keeps serving on the certificate it already has.
locals {
  certificate_domains = length(var.certificate_domains) > 0 ? var.certificate_domains : var.domain_aliases
}

resource "aws_acm_certificate" "this" {
  provider = aws.us_east_1

  domain_name               = var.root_domain
  subject_alternative_names = [for d in local.certificate_domains : d if d != var.root_domain]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Blocks until ACM reports ISSUED, so the distribution can never be handed a
# certificate CloudFront will refuse. The DNS records come from the
# `certificate_validation_records` output and are added in Cloudflare by hand;
# `infra/scripts/enable-admin-domain.sh` drives that sequence.
resource "aws_acm_certificate_validation" "this" {
  count    = var.enable_custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.this.arn

  timeouts {
    create = "60m"
  }
}

# ---- Edge function: admin host root → /admin ---------------------------------

resource "aws_cloudfront_function" "admin_root_redirect" {
  count = var.admin_host != "" ? 1 : 0

  name    = "${var.name}-admin-root-redirect"
  runtime = "cloudfront-js-2.0"
  comment = "Sends ${var.admin_host}/ to /admin before any HTML is served"
  publish = true
  code = templatefile("${path.module}/functions/admin-root-redirect.js", {
    admin_host = var.admin_host
  })
}

# ---- Distribution -------------------------------------------------------------

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.name} web SPA"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = var.enable_custom_domain ? var.domain_aliases : []
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-spa"
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-spa"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.this.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id

    # Viewer-request: runs before the cache is consulted, so the redirect cannot
    # be served from — or poison — a cached object. The cache key carries no Host
    # header, which is safe precisely because every host is served the same
    # bytes; the hostname only ever changes what the edge decides here.
    dynamic "function_association" {
      for_each = var.admin_host != "" ? [1] : []
      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.admin_root_redirect[0].arn
      }
    }
  }

  # SPA client-side routing: unknown keys return index.html (200), not S3's 403.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.enable_custom_domain ? null : true
    # The *validated* ARN, so an apply that adds a hostname waits for the
    # certificate instead of failing against CloudFront.
    acm_certificate_arn      = var.enable_custom_domain ? aws_acm_certificate_validation.this[0].certificate_arn : null
    ssl_support_method       = var.enable_custom_domain ? "sni-only" : null
    minimum_protocol_version = var.enable_custom_domain ? "TLSv1.2_2021" : "TLSv1"
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    include_cookies = false
    prefix          = "cloudfront/"
  }

  depends_on = [aws_s3_bucket_ownership_controls.logs]
}

# ---- Bucket policy: only this distribution (via OAC) may read -----------------

data "aws_iam_policy_document" "site" {
  statement {
    sid       = "AllowCloudFrontOAC"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}
