variable "name" {
  type = string
}

variable "github_repository" {
  description = "owner/repo allowed to assume the deploy role, e.g. RoofersLabs/rooferslabs."
  type        = string
}

variable "allowed_branches" {
  description = "Branches whose workflow runs may assume the role. Anything else is refused by the trust policy."
  type        = list(string)
  default     = ["main", "develop"]
}

variable "create_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider. Set false if one already exists (it is a singleton per account). Must be a plan-time literal."
  type        = bool
  default     = true
}

variable "web_bucket_arn" {
  description = "ARN of the S3 bucket the SPA is synced to."
  type        = string
}

variable "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution to invalidate."
  type        = string
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs CI may push images to."
  type        = list(string)
  default     = []
}

variable "ecs_service_arns" {
  description = "ECS service ARNs CI may force a new deployment on."
  type        = list(string)
  default     = []
}
