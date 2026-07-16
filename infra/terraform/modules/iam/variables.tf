variable "name" {
  type = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the execution role may read."
  type        = list(string)
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the application task role may read/write."
  type        = list(string)
  default     = []
}
