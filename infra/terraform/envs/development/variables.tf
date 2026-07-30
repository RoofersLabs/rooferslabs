# =============================================================================
# RoofersLabs development — input variables
# =============================================================================
# Copy terraform.tfvars.example → terraform.tfvars and fill in.
# terraform.tfvars is gitignored and must stay that way.

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  description = "Names every resource. Changing it builds a parallel environment rather than renaming this one."
  type        = string
  default     = "development"

  validation {
    condition     = var.environment != "production"
    error_message = "This root must never be applied as \"production\". Production lives in envs/production with its own state."
  }
}

# ---- Networking ---------------------------------------------------------------

variable "vpc_cidr" {
  description = <<-EOT
    Address space for the development VPC.

    Deliberately not production's 10.0.0.0/16. Distinct ranges mean the two can
    be peered later without renumbering, and that a misread route table is
    obvious rather than plausible.
  EOT
  type        = string
  default     = "10.10.0.0/16"

  validation {
    condition     = var.vpc_cidr != "10.0.0.0/16"
    error_message = "10.0.0.0/16 is production's VPC CIDR. Development must use a different range."
  }
}

variable "developer_cidr_blocks" {
  description = <<-EOT
    Addresses permitted to reach the development database, as a.b.c.d/32.

    This is the entire access boundary for a public endpoint — treat widening it
    as a security decision. Find your current address with:

      curl -s https://checkip.amazonaws.com

    On a residential connection this changes; re-apply when it does. If that
    becomes tiresome, that is the signal to move to the SSM-bastion topology
    described in docs/environments.md rather than to widen this.
  EOT
  type        = list(string)

  validation {
    condition     = length(var.developer_cidr_blocks) > 0
    error_message = "At least one address is required, or nothing can reach the development database."
  }

  validation {
    condition     = alltrue([for c in var.developer_cidr_blocks : endswith(c, "/32")])
    error_message = "Use single addresses (a.b.c.d/32). A wider block is rarely what was meant and is never checked again once set."
  }
}

# ---- Database -------------------------------------------------------------------

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_backup_retention_days" {
  description = "Backup retention for the development database. Short on purpose: this environment is rebuildable from migrations."
  type        = number
  default     = 1
}

# ---- Credentials (DEVELOPMENT instances only) -----------------------------------
# Every value here belongs to a development/sandbox account. Terraform refuses
# the plan on a production key, and the API refuses to boot on one.

variable "clerk_secret_key" {
  description = "Clerk DEVELOPMENT instance secret key (sk_test_…)."
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  description = "Clerk DEVELOPMENT instance publishable key (pk_test_…). Consumed by the local web build."
  type        = string
}

variable "openai_api_key" {
  description = <<-EOT
    OpenAI key for development. Use a separate key from production's — ideally
    one on its own project with a low monthly cap, so a runaway local loop
    cannot spend the production budget.
  EOT
  type        = string
  sensitive   = true
}

variable "twilio_account_sid" {
  description = "Twilio SID for development. Leave empty to run locally with telephony disabled — the safe default if there is no separate Twilio subaccount."
  type        = string
  sensitive   = true
  default     = ""
}

variable "twilio_auth_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "paddle_api_key" {
  description = "Paddle SANDBOX API key (pdl_sdbx_…). Empty runs local development with billing disabled."
  type        = string
  sensitive   = true
  default     = ""
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
