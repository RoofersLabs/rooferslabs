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

variable "target_group_arn_suffix" {
  description = <<-EOT
    Narrow the 5xx alarm to one target group instead of the whole load balancer.

    Empty (the default) measures every response the load balancer serves, which
    is correct when the environment owns it. Set it when the load balancer is
    shared with another environment — otherwise each environment's alarm fires
    on the other's incidents.
  EOT
  type        = string
  default     = ""
}

variable "cluster_name" {
  type = string
}

variable "api_service_name" {
  type = string
}
