variable "name" {
  type = string
}

variable "services" {
  description = "Service names that get a log group (/<name>/<service>)."
  type        = list(string)
  default     = ["api", "web"]
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alarm_email" {
  description = "Email address for alarm notifications (empty = alarms without actions)."
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "api_service_name" {
  type = string
}
