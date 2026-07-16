variable "name" {
  type = string
}

variable "secret_arns" {
  description = "Secrets Manager ARNs the execution role may read."
  type        = list(string)
}

variable "enable_s3_access" {
  description = "Attach the S3 policy to the task role. Must be a plan-time literal."
  type        = bool
  default     = true
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the application task role may read/write."
  type        = list(string)
  default     = []
}

variable "enable_sqs_access" {
  description = "Attach the SQS policy to the task role. Must be a plan-time literal."
  type        = bool
  default     = true
}

variable "sqs_queue_arns" {
  description = "SQS queue ARNs the application task role may use (jobs queue + DLQ)."
  type        = list(string)
  default     = []
}
