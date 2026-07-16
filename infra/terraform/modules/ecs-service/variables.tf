variable "name" {
  description = "Service name (e.g. rooferslabs-production-api)."
  type        = string
}

variable "region" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "security_group_id" {
  description = "Pre-created service security group; when null the module creates one."
  type        = string
  default     = null
}

variable "target_group_arn" {
  type = string
}

variable "container_name" {
  type = string
}

variable "container_port" {
  type = number
}

variable "image_repository_url" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "cpu" {
  type    = number
  default = 512
}

variable "memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "log_group_name" {
  type = string
}

variable "environment" {
  description = "Plain environment variables (name → value)."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret environment variables (name → Secrets Manager valueFrom reference)."
  type        = map(string)
  default     = {}
}

variable "health_check_grace_period_seconds" {
  description = "Grace period before ALB health checks count; covers boot-time migrations."
  type        = number
  default     = 120
}
