# =============================================================================
# RoofersLabs production — input variables
# =============================================================================
# Copy terraform.tfvars.example → terraform.tfvars and fill in the values.
# Only external credentials and your domain are required; everything else has
# sensible production defaults.

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  type    = string
  default = "production"
}

# ---- Domains -----------------------------------------------------------------

variable "root_domain" {
  description = "Your apex domain managed in Cloudflare (e.g. rooferslabs.com)."
  type        = string
}

variable "api_subdomain" {
  type    = string
  default = "api"
}

variable "app_subdomain" {
  description = "Application hostname served from the same distribution as the apex (app.<root_domain>)."
  type        = string
  default     = "app"
}

variable "admin_subdomain" {
  description = "Internal admin portal subdomain. Allowed in CORS ahead of the portal being built; nothing is provisioned for it yet."
  type        = string
  default     = "admin"
}

variable "enable_https" {
  description = "Serve HTTPS on the ALB. Two-phase: apply with false, add the ACM validation CNAMEs from the outputs to Cloudflare, then apply with true."
  type        = bool
  default     = false
}

# ---- Frontend (S3 + CloudFront) ----------------------------------------------

variable "request_app_certificate" {
  description = <<-EOT
    Stage 1 of exposing app.<root_domain>: add it to the ACM certificate.

    Replaces the certificate, so the new one is PENDING_VALIDATION until its
    CNAMEs are added in Cloudflare. The distribution keeps serving the apex on
    the certificate it already has throughout. Run
    infra/scripts/enable-app-domain.sh rather than flipping this by hand — it
    applies the stages in the right order and prints the records to add.
  EOT
  type        = bool
  default     = false
}

variable "enable_app_alias" {
  description = <<-EOT
    Stage 2: attach app.<root_domain> to the distribution. Only set this once
    the certificate from stage 1 reports ISSUED, or CloudFront rejects the
    alias and the apply fails with the site still serving (no outage, but a
    wasted 20 minutes).
  EOT
  type        = bool
  default     = false
}

variable "request_admin_certificate" {
  description = <<-EOT
    Stage 1 of exposing admin.<root_domain>: add it to the ACM certificate.

    Replaces the certificate, so the new one is PENDING_VALIDATION until its
    CNAMEs are added in Cloudflare. The distribution keeps serving on the old
    certificate throughout. Run infra/scripts/enable-admin-domain.sh rather than
    flipping this by hand — it applies the stages in the right order.
  EOT
  type        = bool
  default     = false
}

variable "enable_admin_alias" {
  description = <<-EOT
    Stage 2: attach admin.<root_domain> to the distribution and publish the edge
    function that sends its root to /admin. Only set this once the certificate
    from stage 1 reports ISSUED.
  EOT
  type        = bool
  default     = false
}

variable "enable_web_custom_domain" {
  description = "Attach the apex + www aliases and ACM cert to the CloudFront distribution. Two-phase, like enable_https: apply false → add the web cert validation CNAMEs in Cloudflare → apply true."
  type        = bool
  default     = false
}

variable "web_price_class" {
  description = "CloudFront price class for the frontend distribution."
  type        = string
  default     = "PriceClass_100"
}

variable "web_content_security_policy" {
  description = "Override the generated Content-Security-Policy for the frontend. Empty = use the module's Clerk/fonts/API-aware default. Validate against the live Clerk instance before trusting it."
  type        = string
  default     = ""
}

# ---- External credentials (the only secrets you must provide) ------------------

variable "clerk_secret_key" {
  description = "Clerk → API Keys → Secret key (sk_live_…)."
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  description = "Clerk → API Keys → Publishable key (pk_live_…). Also baked into the web image at build time."
  type        = string
}

variable "clerk_webhook_secret" {
  description = "Clerk → Webhooks signing secret (optional)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key (sk-…)."
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio Console → Account SID (AC…)."
  type        = string
  sensitive   = true
}

variable "twilio_auth_token" {
  description = "Twilio Console → Auth token."
  type        = string
  sensitive   = true
}

variable "vapid_public_key" {
  description = "Web Push VAPID public key (npx web-push generate-vapid-keys)."
  type        = string
  default     = ""
}

variable "vapid_private_key" {
  description = "Web Push VAPID private key."
  type        = string
  sensitive   = true
  default     = ""
}

variable "vapid_subject" {
  type    = string
  default = "mailto:support@rooferslabs.com"
}

# ---- Sizing (production-sane defaults, tune later) ------------------------------

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_deletion_protection" {
  type    = bool
  default = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alarm_email" {
  description = "Email for CloudWatch alarm notifications (empty disables notifications)."
  type        = string
  default     = ""
}

variable "openai_realtime_model" {
  type    = string
  default = "gpt-realtime"
}

# Fleet default only — a company's own voice (Settings → AI) always wins.
variable "openai_realtime_voice" {
  type    = string
  default = "marin"
}

variable "openai_responses_model" {
  type    = string
  default = "gpt-4.1"
}

variable "openai_embedding_model" {
  type    = string
  default = "text-embedding-3-small"
}

# ---- CI deploy role ---------------------------------------------------------

variable "github_repository" {
  description = "owner/repo whose GitHub Actions runs may assume the deploy role."
  type        = string
  default     = "RoofersLabs/rooferslabs"
}

variable "github_deploy_branches" {
  description = <<-EOT
    Branches allowed to deploy PRODUCTION. A run on any other ref cannot assume
    the role, so it could not deploy here even if its configuration told it to.

    This is `main` alone, and the reason is not stylistic: while it also listed
    `develop`, a push to develop deployed straight to rooferslabs.com. The
    development environment has its own role in envs/development, trusting
    `develop` alone.
  EOT
  type        = list(string)
  default     = ["main"]

  validation {
    condition     = !contains(var.github_deploy_branches, "develop")
    error_message = "develop deploys development. Trusting it here is how a work-in-progress branch reaches customers."
  }
}

variable "github_org_id" {
  description = "Numeric GitHub org id, used by the OIDC trust policy (this org emits immutable unique-ID subject claims)."
  type        = string
  default     = "305356388"
}

variable "github_repository_id" {
  description = "Numeric GitHub repository id, used by the OIDC trust policy."
  type        = string
  default     = "1301242105"
}
