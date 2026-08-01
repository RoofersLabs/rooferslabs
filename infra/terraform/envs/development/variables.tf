# =============================================================================
# RoofersLabs development — input variables
# =============================================================================
# Copy terraform.tfvars.example → terraform.tfvars and fill in.
#
# This root is deliberately leaner than envs/production: the development
# environment has no admin portal, no multi-AZ, no alarm routing, and no
# certificate staging dance for hostnames it will never serve.

variable "aws_region" {
  description = "AWS region. Must match the shared stack's region — the target group has to live in the shared load balancer's VPC."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  type    = string
  default = "development"

  validation {
    # The whole point of this root. Pointing it at "production" would build a
    # second stack under production's names, inside production's VPC.
    condition     = var.environment != "production"
    error_message = "This root provisions the non-production environment. Use envs/production for production."
  }
}

# ---- Domains -----------------------------------------------------------------

variable "root_domain" {
  description = "Apex domain managed in Cloudflare (e.g. rooferslabs.com). Development hangs off a subdomain of it."
  type        = string
}

variable "environment_subdomain" {
  description = "Label the whole environment lives under: <this>.<root_domain> serves the SPA, api.<this>.<root_domain> the API."
  type        = string
  default     = "dev"

  validation {
    condition     = var.environment_subdomain != ""
    error_message = "environment_subdomain must not be empty — development may never be served from the apex."
  }
}

variable "api_subdomain" {
  type    = string
  default = "api"
}

variable "local_cors_origins" {
  description = <<-EOT
    Extra browser origins the development API accepts, on top of its own SPA.

    Defaults to the Vite dev server so a frontend running on a laptop can be
    pointed at the deployed development API — which is most of the reason to
    have a deployed development API. Production allows no such thing.
  EOT
  type        = list(string)
  default     = ["http://localhost:5173"]
}

# ---- Shared infrastructure ---------------------------------------------------

variable "shared_stack_name" {
  description = <<-EOT
    Name prefix of the stack whose VPC and load balancer this environment
    borrows — i.e. the production stack's `local.name`.

    Only idle capacity is shared: the VPC, its NAT gateway, and the ALB. Every
    resource that holds or routes data (target group, ECS service, database,
    cache, secrets, buckets, CDN) is this environment's own.
  EOT
  type        = string
  default     = "rooferslabs-production"
}

variable "alb_rule_priority" {
  description = "Priority of the host-header rule added to the shared HTTPS listener. Must not collide with a rule production adds later."
  type        = number
  default     = 100
}

# ---- Two-phase hostname enablement -------------------------------------------

variable "enable_https" {
  description = "Attach the API certificate + host rule to the shared listener. Apply false first, add the ACM validation CNAMEs from the outputs to Cloudflare, then apply true."
  type        = bool
  default     = false
}

variable "enable_web_custom_domain" {
  description = "Attach dev.<root_domain> and its ACM certificate to the CloudFront distribution. Two-phase, exactly like enable_https."
  type        = bool
  default     = false
}

variable "web_price_class" {
  description = "CloudFront price class. Development has no reason to pay for edge locations it will never be visited from."
  type        = string
  default     = "PriceClass_100"
}

variable "web_content_security_policy" {
  description = "Override the generated Content-Security-Policy. Empty = the module's Clerk/fonts/API-aware default."
  type        = string
  default     = ""
}

# ---- External credentials — DEVELOPMENT VALUES ONLY --------------------------
#
# Nothing here may be a production credential. The guardrails below are the
# enforceable part of that; the rest is discipline. See docs/environments.md.

variable "clerk_secret_key" {
  description = "Clerk DEVELOPMENT instance secret key (sk_test_…)."
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  description = "Clerk DEVELOPMENT instance publishable key (pk_test_…). Also baked into the SPA at build time."
  type        = string
}

variable "clerk_webhook_secret" {
  description = "Clerk webhook signing secret for the development instance (optional)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "allow_live_clerk_key" {
  description = <<-EOT
    Escape hatch for the guardrail that refuses a pk_live_/sk_live_ key in this
    environment. There is no legitimate reason to set it: a live Clerk key here
    would let development sessions act on production identities.
  EOT
  type        = bool
  default     = false
}

variable "openai_api_key" {
  description = "OpenAI API key for development. Use a separate key from production so spend and rate limits are attributable."
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio Account SID for development (a subaccount or test credentials, not the production account)."
  type        = string
  sensitive   = true
}

variable "twilio_auth_token" {
  type      = string
  sensitive = true
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

# ---- Billing -----------------------------------------------------------------

variable "payments_enabled" {
  description = "Master switch for billing. False opens the payment wall entirely: no provider client, no webhook route, every tenant reaches the product without a subscription."
  type        = bool
  default     = true
}

variable "payment_provider" {
  description = "Which processor handles money: \"paypal\" or \"stripe\"."
  type        = string
  default     = "paypal"

  validation {
    condition     = contains(["paypal", "stripe"], var.payment_provider)
    error_message = "payment_provider must be either \"paypal\" or \"stripe\"."
  }
}

variable "paypal_environment" {
  description = "Which PayPal estate development bills against. Must be sandbox — see the precondition in main.tf."
  type        = string
  default     = "sandbox"

  validation {
    condition     = contains(["sandbox", "live"], var.paypal_environment)
    error_message = "paypal_environment must be either \"sandbox\" or \"live\"."
  }
}

variable "paypal_client_id" {
  description = "PayPal SANDBOX REST app Client ID. Server-side only — PayPal's checkout is a redirect, so the browser never receives a credential."
  type        = string
  sensitive   = true
  default     = ""
}

variable "paypal_client_secret" {
  description = "PayPal SANDBOX REST app Secret."
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
  description = "Id of the PayPal sandbox webhook pointed at this environment's /v1/billing/webhook/paypal. Not a secret: it names the webhook whose signature PayPal should check a delivery against."
  type        = string
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe TEST secret key (sk_test_…). Only read when payment_provider = \"stripe\"."
  type        = string
  sensitive   = true
  default     = ""
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
  description = "RFC3339 instant; companies created before it skip the payment wall. Empty applies the wall to every tenant."
  type        = string
  default     = ""
}

# ---- Web push ----------------------------------------------------------------

variable "vapid_public_key" {
  description = "Web Push VAPID public key. Generate a SEPARATE pair from production — subscriptions are keyed to it."
  type        = string
  default     = ""
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

# ---- Sizing (development-sane: smallest of everything) -----------------------

variable "api_cpu" {
  type    = number
  default = 256
}

variable "api_memory" {
  type    = number
  default = 512
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_deletion_protection" {
  description = "Development data is reproducible, so this defaults to false — the environment can be torn down and rebuilt without a console visit."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 1
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "log_retention_days" {
  type    = number
  default = 7
}

variable "alarm_email" {
  description = "Email for CloudWatch alarms. Empty (the default) means development pages nobody."
  type        = string
  default     = ""
}

# ---- CI deploy role ----------------------------------------------------------

variable "github_repository" {
  description = "owner/repo whose GitHub Actions runs may assume the development deploy role."
  type        = string
  default     = "RoofersLabs/rooferslabs"
}

variable "github_deploy_branches" {
  description = "Branches allowed to deploy to development. Exactly one branch per environment is what makes the split enforceable at the IAM layer."
  type        = list(string)
  default     = ["develop"]

  validation {
    condition     = !contains(var.github_deploy_branches, "main")
    error_message = "main deploys production. Allowing it here would let a production merge redeploy development from the same run."
  }
}

variable "github_org_id" {
  description = "Numeric GitHub org id, used by the OIDC trust policy."
  type        = string
  default     = "305356388"
}

variable "github_repository_id" {
  description = "Numeric GitHub repository id, used by the OIDC trust policy."
  type        = string
  default     = "1301242105"
}
