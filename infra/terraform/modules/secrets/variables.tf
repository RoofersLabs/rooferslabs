variable "name" {
  type = string
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "app_secrets" {
  description = "Map of secret env var name → value (CLERK_SECRET_KEY, OPENAI_API_KEY, ...)."
  type        = map(string)
  sensitive   = true
}

variable "recovery_window_in_days" {
  description = "Days a deleted secret can be recovered (0 = immediate deletion, useful for teardown testing)."
  type        = number
  default     = 7
}
