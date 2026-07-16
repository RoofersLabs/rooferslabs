variable "name" {
  description = "Registry namespace prefix (e.g. rooferslabs)."
  type        = string
}

variable "repositories" {
  description = "Repository names to create under the namespace."
  type        = list(string)
  default     = ["api", "web"]
}

variable "max_image_count" {
  description = "Maximum images retained per repository."
  type        = number
  default     = 20
}

variable "force_delete" {
  description = "Allow terraform destroy to delete repositories that still contain images."
  type        = bool
  default     = false
}
