# =============================================================================
# frontend-cdn — outputs
# =============================================================================

output "bucket_name" {
  description = "S3 bucket the built SPA is synced to (deploy-web.sh target)."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "CloudFront distribution id (deploy-web.sh invalidation target)."
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_domain_name" {
  description = "CloudFront domain (e.g. dxxxx.cloudfront.net). Point the Cloudflare CNAME(s) for the apex + www here."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}

output "certificate_arn" {
  value = aws_acm_certificate.this.arn
}

output "certificate_validation_records" {
  description = "CNAMEs to add in Cloudflare (DNS-only) so the ACM certificate can issue; then apply with enable_custom_domain = true."
  value = [
    for dvo in aws_acm_certificate.this.domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}

output "logs_bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
