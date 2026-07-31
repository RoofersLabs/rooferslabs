variable "name" {
  description = "Target group name (e.g. rooferslabs-development-api). ALB target group names are capped at 32 characters."
  type        = string

  validation {
    condition     = length(var.name) <= 32
    error_message = "ALB target group names may be at most 32 characters."
  }
}

variable "host" {
  description = "Hostname routed to this target group (e.g. api.dev.rooferslabs.com)."
  type        = string
}

variable "vpc_id" {
  description = "VPC of the shared load balancer. The target group must live in it."
  type        = string
}

variable "listener_arn" {
  description = "ARN of the existing HTTPS listener to attach the certificate and host rule to."
  type        = string
}

variable "rule_priority" {
  description = "Listener rule priority. Must be unique across every rule on the shared listener."
  type        = number
  default     = 100
}

variable "container_port" {
  type    = number
  default = 4000
}

variable "health_check_path" {
  type    = string
  default = "/v1/health/ready"
}

variable "enable_https" {
  description = <<-EOT
    Attach the issued certificate to the shared listener, so TLS for this
    hostname can complete. Two-phase: apply false, add the ACM validation CNAMEs
    from the outputs to Cloudflare, wait for ISSUED, then apply true.

    The host rule is NOT gated on this — it is created either way, because it is
    what associates the target group with the load balancer and ECS will not
    create a service without that. See the note in main.tf.
  EOT
  type        = bool
  default     = false
}
