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

variable "payments_enabled" {
  description = <<-EOT
    Master switch for billing. When false the API boots with no payment
    credentials at all: no provider client is constructed, no webhook route is
    registered, the billing endpoints answer 503, and every tenant reaches the
    product without a subscription (onboarding leads straight to the
    dashboard). Set to true — together with the active provider's credentials —
    to restore the payment wall.
  EOT
  type        = bool
  default     = true
}

variable "payment_provider" {
  description = <<-EOT
    Which processor handles money: "paddle" or "stripe". Exactly one is active;
    the other stays implemented in the codebase but is never constructed and
    refuses every call. Switching is a configuration change — set this and
    supply that provider's credentials below.
  EOT
  type        = string
  default     = "paddle"

  validation {
    # Guessing at an unrecognized value would bill through a processor nobody
    # chose, so fail the plan instead.
    condition     = contains(["paddle", "stripe"], var.payment_provider)
    error_message = "payment_provider must be either \"paddle\" or \"stripe\"."
  }
}

# ---- Paddle (the active provider) ---------------------------------------------------
#
# These default to empty so the stack can be applied before the Paddle account
# is live. The precondition in main.tf makes that safe: they become mandatory
# the moment payments_enabled is true and paddle is selected, so an apply can
# never turn the wall on without the credentials to enforce it.

variable "paddle_api_key" {
  description = "Paddle → Developer tools → Authentication → API key (pdl_live_…)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "paddle_client_token" {
  description = <<-EOT
    Paddle → Developer tools → Authentication → client-side token (live_…).
    Publishable by design: it only opens checkouts and is served to the browser
    by the API. Marked sensitive anyway so it is not echoed in plan output.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "paddle_webhook_secret" {
  description = <<-EOT
    Paddle → Developer tools → Notifications → destination secret key
    (pdl_ntfset_…) for the /v1/billing/webhook/paddle endpoint.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "paddle_environment" {
  description = "Which Paddle system to bill against: \"sandbox\" or \"production\"."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["sandbox", "production"], var.paddle_environment)
    error_message = "paddle_environment must be either \"sandbox\" or \"production\"."
  }
}

variable "paddle_price_starter_monthly" {
  description = "Paddle recurring Price ID (pri_…) backing the monthly Starter plan."
  type        = string
  default     = ""
}

variable "paddle_price_professional_monthly" {
  description = "Paddle recurring Price ID (pri_…) backing the monthly Professional plan."
  type        = string
  default     = ""
}

variable "paddle_price_starter_annual" {
  description = <<-EOT
    Paddle Price ID for annual Starter. Optional: empty means annual billing is
    not offered, and the API refuses a checkout for it rather than inventing a
    price. Launching annual plans is setting this and its Professional twin.
  EOT
  type        = string
  default     = ""
}

variable "paddle_price_professional_annual" {
  description = "Paddle Price ID for annual Professional. Optional; see the Starter twin."
  type        = string
  default     = ""
}

# ---- Stripe (dormant) ---------------------------------------------------------------
#
# Retained so moving back to Stripe is a configuration change rather than a
# rewrite. Never required while payment_provider = "paddle"; the API boots with
# no Stripe account whatsoever.

variable "stripe_secret_key" {
  description = "Stripe Dashboard → Developers → API keys → secret key (sk_live_…)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Signing secret (whsec_…) for the /v1/billing/webhook/stripe endpoint."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_starter" {
  description = "Stripe recurring Price ID backing the Starter plan."
  type        = string
  default     = ""
}

variable "stripe_price_professional" {
  description = "Stripe recurring Price ID backing the Professional plan."
  type        = string
  default     = ""
}

variable "billing_trial_period_days" {
  description = <<-EOT
    Free-trial length applied to new checkouts. 0 disables trials.

    Honoured by Stripe only. Paddle attaches trials to the *price* rather than
    to the checkout, so under Paddle this is configured in the Paddle dashboard
    and the API logs a warning if this is set to anything but 0.
  EOT
  type        = number
  default     = 0
}

variable "billing_grandfather_before" {
  description = <<-EOT
    RFC3339 instant. Companies created strictly before it keep full access
    without paying; everyone created on or after it hits the payment wall.
    Empty (the default) applies the wall to every tenant.
  EOT
  type        = string
  default     = ""
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
  description = "Branches allowed to deploy. A run on any other ref cannot assume the role."
  type        = list(string)
  default     = ["main", "develop"]
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
