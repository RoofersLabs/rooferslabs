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
    Which processor handles money: "paypal" or "stripe". Exactly one is active;
    the other stays implemented in the codebase but is never constructed and
    refuses every call. Switching is a configuration change — set this and
    supply that provider's credentials below.
  EOT
  type        = string
  default     = "paypal"

  validation {
    # Guessing at an unrecognized value would bill through a processor nobody
    # chose, so fail the plan instead.
    condition     = contains(["paypal", "stripe"], var.payment_provider)
    error_message = "payment_provider must be either \"paypal\" or \"stripe\"."
  }
}

# ---- PayPal (the active provider) ----------------------------------------------------
#
# These default to empty so the stack can be applied before the PayPal account
# is live. The precondition in main.tf makes that safe: they become mandatory
# the moment payments_enabled is true and paypal is selected, so an apply can
# never turn the wall on without the credentials to enforce it.

variable "paypal_client_id" {
  description = <<-EOT
    PayPal Developer Dashboard -> Apps & Credentials -> your REST app -> Client ID
    (live app).

    Server-side only. Unlike a publishable key this never reaches the browser:
    PayPal's checkout is a redirect to an approval URL the API mints, so the
    client needs no credential at all.
  EOT
  type        = string
  sensitive   = true
  default     = ""
}

variable "paypal_client_secret" {
  description = "PayPal Developer Dashboard -> Apps & Credentials -> your REST app -> Secret (live app)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "paypal_test_pricing" {
  description = <<-EOT
    Charge the provisioned $1.00 test plan instead of the published $49.00 one.

    For proving a LIVE payment pipeline end to end — real credentials, real
    webhook signatures, real money arriving in the bank — without taking a full
    subscription fee to do it. The $1.00 plan is a separate PayPal plan created
    by `npm run billing:paypal:setup`; the published plan is never modified.

    Nothing else changes: the site still advertises $49 everywhere, and the
    customer sees $1.00 for the first time on PayPal's own approval page.

    Set it back to false to restore the published price for NEW checkouts.
    Subscriptions created while it was true keep renewing at $1.00.
  EOT
  type        = bool
  default     = false
}

variable "paypal_webhook_id" {
  description = <<-EOT
    PayPal Developer Dashboard -> Webhooks -> the webhook registered against
    /v1/billing/webhook/paypal, its ID (not its URL).

    Not a secret and not a signing key: PayPal verifies a delivery by having the
    API post the headers and body back to it along with this id, so possession
    proves nothing. It is required because that call names the webhook whose
    certificate should have signed the payload — without it every inbound
    webhook is rejected.
  EOT
  type        = string
  default     = ""
}

variable "paypal_environment" {
  description = "Which PayPal estate to bill against: \"sandbox\" or \"live\"."
  type        = string
  default     = "live"

  validation {
    condition     = contains(["sandbox", "live"], var.paypal_environment)
    error_message = "paypal_environment must be either \"sandbox\" or \"live\"."
  }
}

# ---- Stripe (dormant) ---------------------------------------------------------------
#
# Retained so moving back to Stripe is a configuration change rather than a
# rewrite. Never required while payment_provider = "paypal"; the API boots with
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

    Honoured by Stripe only. PayPal attaches a trial to the *plan*, as a billing
    cycle with tenure_type TRIAL, so under PayPal this is configured on the plan
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
