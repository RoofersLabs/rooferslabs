variable "aws_region" {
  description = "Region for the state bucket. Must match the `region` in each environment's backend block."
  type        = string
  default     = "us-east-1"
}
