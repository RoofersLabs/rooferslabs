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
  type    = string
  default = "app"
}

variable "enable_https" {
  description = "Serve HTTPS on the ALB. Two-phase: apply with false, add the ACM validation CNAMEs from the outputs to Cloudflare, then apply with true."
  type        = bool
  default     = false
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

variable "web_cpu" {
  type    = number
  default = 256
}

variable "web_memory" {
  type    = number
  default = 512
}

variable "web_desired_count" {
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
