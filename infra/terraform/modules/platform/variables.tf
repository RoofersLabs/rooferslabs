# =============================================================================
# platform — input variables
# =============================================================================
# Grouped by what an environment root actually has to decide. Anything with a
# default is the same in every environment unless there is a reason otherwise;
# anything without one is a genuine per-environment fact.

variable "environment" {
  description = "Deployment tier. Names every resource and selects the production-only guardrails."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,20}$", var.environment))
    error_message = "environment must be lowercase alphanumeric with hyphens, 3-21 characters."
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

# ---- Networking (created by the root, not here) ------------------------------

variable "vpc_id" {
  description = "VPC this environment runs in, created by modules/networking in the environment root."
  type        = string
}

variable "public_subnet_ids" {
  description = "Subnets for the ALB. Must belong to this environment, not a sibling's."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Subnets for ECS tasks, RDS, and Redis."
  type        = list(string)
}

# ---- Domains -----------------------------------------------------------------

variable "root_domain" {
  description = "Apex domain (rooferslabs.com). Used for CSP source construction only; it is not necessarily a hostname this environment serves."
  type        = string
}

variable "web_domain" {
  description = "Primary hostname for this environment's SPA (rooferslabs.com, devstage.rooferslabs.com). Also the ACM certificate's primary domain."
  type        = string
}

variable "web_domain_aliases" {
  description = "Additional hostnames served by the same distribution (e.g. www). Empty for a subdomain environment."
  type        = list(string)
  default     = []
}

variable "api_domain" {
  description = "Hostname for this environment's API (api.rooferslabs.com, api.devstage.rooferslabs.com)."
  type        = string
}

variable "admin_domain" {
  description = "Internal admin portal hostname. Empty disables the admin alias, certificate SAN, edge function, and CORS entry entirely."
  type        = string
  default     = ""
}

variable "clerk_frontend_host" {
  description = "Clerk Frontend API host for the CSP. Empty uses clerk.<root_domain>; a Clerk development instance needs no value (it is covered by the *.clerk.accounts.dev wildcard)."
  type        = string
  default     = ""
}

variable "enable_https" {
  description = "Serve HTTPS on the ALB. Two-phase: apply false, add the ACM validation CNAMEs to DNS, apply true."
  type        = bool
  default     = false
}

# ---- Frontend (S3 + CloudFront) ----------------------------------------------

variable "web_bucket_name" {
  description = "Globally unique bucket name for this environment's SPA origin."
  type        = string
}

variable "enable_web_custom_domain" {
  description = "Attach the aliases and ACM certificate to the distribution. Two-phase, like enable_https."
  type        = bool
  default     = false
}

variable "request_admin_certificate" {
  description = "Stage 1 of exposing the admin host: add it to the ACM certificate. See infra/scripts/enable-admin-domain.sh."
  type        = bool
  default     = false
}

variable "enable_admin_alias" {
  description = "Stage 2: attach the admin host to the distribution. Only once stage 1's certificate reports ISSUED."
  type        = bool
  default     = false
}

variable "web_price_class" {
  type    = string
  default = "PriceClass_100"
}

variable "web_content_security_policy" {
  description = "Override the generated CSP. Empty uses the module's Clerk/Paddle/fonts/API-aware default."
  type        = string
  default     = ""
}

# ---- Container registry ------------------------------------------------------

variable "ecr_namespace" {
  description = <<-EOT
    Registry namespace, yielding <namespace>/api. Per-environment by default so
    a development image is not merely untagged-for-production but unreachable
    from the production task role.

    Production keeps the historical value "rooferslabs" so its existing
    repository is not replaced.
  EOT
  type        = string
}

# ---- External credentials ----------------------------------------------------

variable "clerk_secret_key" {
  description = "Clerk secret key. sk_live_… in production, sk_test_… everywhere else."
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  description = "Clerk publishable key. pk_live_… in production, pk_test_… everywhere else."
  type        = string
}

variable "clerk_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "openai_api_key" {
  type      = string
  sensitive = true
}

variable "twilio_account_sid" {
  type      = string
  sensitive = true
}

variable "twilio_auth_token" {
  type      = string
  sensitive = true
}

# ---- Private beta --------------------------------------------------------------

variable "launch_mode" {
  description = <<-EOT
    "private" gates the whole application behind internal_users and serves
    everyone else the launch page. "public" is normal operation.

    Applies to production only — the API resolves every other tier to "public"
    so local development is never gated.

    Launch day is flipping this to "public" and restarting the service. No code
    change, no frontend rebuild: the SPA reads the mode from the API at runtime.
  EOT
  type        = string
  default     = "public"

  validation {
    condition     = contains(["private", "public"], var.launch_mode)
    error_message = "launch_mode must be either \"private\" or \"public\"."
  }
}

variable "internal_users" {
  description = <<-EOT
    Email addresses permitted through the private-beta gate.

    Configuration, never source — no address is compiled into the application.
    An empty list admits NOBODY, which is the safe direction: the alternative
    would turn a dropped variable into a silent public launch.

    Matched case-insensitively against the identity provider's address.
  EOT
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for e in var.internal_users : can(regex("^[^@,[:space:]]+@[^@,[:space:]]+$", e))])
    error_message = "Each internal_users entry must be a single email address, with no commas or spaces."
  }
}

# ---- Billing -----------------------------------------------------------------

variable "payments_enabled" {
  description = "Master switch for billing. False boots the API with no provider and no payment wall."
  type        = bool
  default     = true
}

variable "payment_provider" {
  type    = string
  default = "paddle"

  validation {
    condition     = contains(["paddle", "stripe"], var.payment_provider)
    error_message = "payment_provider must be either \"paddle\" or \"stripe\"."
  }
}

variable "paddle_environment" {
  description = "Which Paddle system to bill against. Guarded: production requires \"production\", everything else requires \"sandbox\"."
  type        = string
  default     = "sandbox"

  validation {
    condition     = contains(["sandbox", "production"], var.paddle_environment)
    error_message = "paddle_environment must be either \"sandbox\" or \"production\"."
  }
}

variable "paddle_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "paddle_client_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "paddle_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "paddle_price_starter_monthly" {
  type    = string
  default = ""
}

variable "paddle_price_professional_monthly" {
  type    = string
  default = ""
}

variable "paddle_price_starter_annual" {
  type    = string
  default = ""
}

variable "paddle_price_professional_annual" {
  type    = string
  default = ""
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_price_starter" {
  type    = string
  default = ""
}

variable "stripe_price_professional" {
  type    = string
  default = ""
}

variable "billing_trial_period_days" {
  type    = number
  default = 0
}

variable "billing_grandfather_before" {
  type    = string
  default = ""
}

# ---- Guardrail escape hatches ------------------------------------------------
# Both default to false, so the guardrail is on unless an operator consciously
# turns it off in a tfvars file where the reason can be written down. That is
# the difference between a known deviation and an accident.

variable "allow_clerk_instance_mismatch" {
  description = <<-EOT
    Permit a Clerk key whose instance does not match the environment.

    Set only while a migration is in flight, with the reason recorded next to
    it. Leaving it true in production means live customers are authenticating
    against Clerk's development instance.
  EOT
  type        = bool
  default     = false
}

variable "allow_paddle_environment_mismatch" {
  description = <<-EOT
    Permit a Paddle environment that does not match the deployment environment.

    True in production means the payment wall is enforced by Paddle's TEST
    system and collects no money. True in development means test traffic can
    charge real cards.
  EOT
  type        = bool
  default     = false
}

# ---- Web Push ----------------------------------------------------------------

variable "vapid_public_key" {
  type    = string
  default = ""
}

variable "vapid_private_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "vapid_subject" {
  type    = string
  default = "mailto:support@rooferslabs.com"
}

# ---- Sizing and behaviour ----------------------------------------------------

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
  description = "Refuse to destroy the database. True in production; false in development so the environment can be torn down and rebuilt cheaply."
  type        = bool
  default     = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "log_level" {
  description = "API log verbosity. \"info\" in production; \"debug\" in development."
  type        = string
  default     = "info"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alarm_email" {
  type    = string
  default = ""
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

# ---- CI deploy role ----------------------------------------------------------

variable "github_repository" {
  type    = string
  default = "RoofersLabs/rooferslabs"
}

variable "github_deploy_branches" {
  description = <<-EOT
    Branches whose GitHub Actions runs may assume this environment's deploy
    role. Exactly one per environment: ["main"] for production, ["develop"] for
    development. This is the enforcement point for the branch→environment
    mapping — a workflow file cannot widen it.
  EOT
  type        = list(string)

  validation {
    condition     = length(var.github_deploy_branches) == 1
    error_message = "Exactly one branch per environment. Two branches deploying one environment defeats the isolation this split exists to create."
  }
}

variable "github_org_id" {
  type    = string
  default = "305356388"
}

variable "github_repository_id" {
  type    = string
  default = "1301242105"
}
