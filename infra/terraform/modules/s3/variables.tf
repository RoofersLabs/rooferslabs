variable "name" {
  description = "Bucket name prefix — must be globally unique (e.g. rooferslabs-production-123456789012)."
  type        = string
}

variable "buckets" {
  type    = list(string)
  default = ["recordings", "uploads"]
}

variable "versioning" {
  type    = bool
  default = false
}

variable "force_destroy" {
  description = "Allow terraform destroy to delete non-empty buckets."
  type        = bool
  default     = false
}
