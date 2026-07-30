# =============================================================================
# frontend-cdn — inputs
# =============================================================================

variable "name" {
  description = "Resource name prefix (e.g. rooferslabs-production)."
  type        = string
}

variable "bucket_name" {
  description = "Globally-unique S3 bucket name for the built SPA (private; served only via CloudFront)."
  type        = string
}

variable "domain_aliases" {
  description = "Custom domains served by the distribution (apex + www). Attached only when enable_custom_domain = true."
  type        = list(string)
  default     = []
}

variable "certificate_domains" {
  description = <<-EOT
    Domains the ACM certificate covers. Defaults to `domain_aliases` when empty.

    Kept separate from `domain_aliases` on purpose: adding a SAN replaces the
    certificate, and the replacement stays PENDING_VALIDATION until its DNS
    records are added in Cloudflare by hand. Requesting a hostname here first,
    and attaching it to the distribution afterwards, means the live site keeps
    serving on its current certificate throughout.
  EOT
  type        = list(string)
  default     = []
}

variable "admin_host" {
  description = <<-EOT
    Hostname that should land on the admin portal instead of the marketing site,
    e.g. admin.rooferslabs.com. Empty disables the edge redirect entirely and no
    CloudFront function is created.
  EOT
  type        = string
  default     = ""
}

variable "root_domain" {
  description = "Apex domain, used to build the Clerk/self CSP source list."
  type        = string
}

variable "api_domain" {
  description = "API hostname (e.g. api.rooferslabs.com) allowed in connect-src for the CSP."
  type        = string
}

variable "cert_primary_domain" {
  description = <<-EOT
    Hostname ACM issues the certificate under, with certificate_domains carried
    as SANs. Empty (the default) uses root_domain, which is what production
    wants. A subordinate environment must set this to its own hostname —
    otherwise it would request a certificate for the production apex and race
    production over the renewal.
  EOT
  type        = string
  default     = ""
}

variable "clerk_frontend_host" {
  description = <<-EOT
    Clerk Frontend API hostname to allow in the CSP. Empty uses
    clerk.<root_domain>, correct for a Clerk *production* instance served over
    the customer domain. A Clerk *development* instance lives on
    <slug>.clerk.accounts.dev and is already covered by the wildcard, so a
    development environment can leave this empty too.
  EOT
  type        = string
  default     = ""
}

variable "enable_custom_domain" {
  description = <<-EOT
    Two-phase HTTPS, mirroring the ALB module. Apply with false first: the
    distribution serves on its *.cloudfront.net domain with the default cert and
    the ACM certificate's DNS validation records appear in the outputs. Add those
    CNAMEs in Cloudflare (DNS-only), wait for the cert to issue, then apply with
    true to attach the aliases + ACM viewer certificate.
  EOT
  type        = bool
  default     = false
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_100 = NA/EU, cheapest)."
  type        = string
  default     = "PriceClass_100"
}

variable "content_security_policy" {
  description = <<-EOT
    Full Content-Security-Policy header value. Defaults to empty, in which case a
    Clerk/fonts/API-aware policy is generated from root_domain + api_domain. Set
    explicitly to override. MUST be validated against the live Clerk instance
    before relying on it — a wrong CSP silently breaks auth.
  EOT
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Expire CloudFront access logs after N days."
  type        = number
  default     = 90
}

variable "tags" {
  type    = map(string)
  default = {}
}
