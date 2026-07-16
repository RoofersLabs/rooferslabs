variable "name" {
  type = string
}

variable "visibility_timeout_seconds" {
  description = "How long a received message stays hidden; sized for post-call AI processing."
  type        = number
  default     = 120
}

variable "max_receive_count" {
  description = "Delivery attempts before a message moves to the dead-letter queue."
  type        = number
  default     = 5
}
