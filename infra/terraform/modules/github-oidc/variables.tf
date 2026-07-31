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

variable "allowed_environments" {
  description = <<-EOT
    GitHub Environments whose deployments may assume this role.

    Null (the default) derives them from `allowed_branches` using this project's
    branch-to-environment convention — main → production, develop → development
    — so a root that declares its branch gets the matching environment without
    having to repeat itself. Set explicitly to authorize an environment whose
    name does not follow from a branch. An empty list trusts the branch subjects
    alone, which means any workflow using `environment:` will be refused.

    SECURITY: an environment subject carries no branch. `repo:o/r:environment:x`
    says a job targeting environment x ran — not which ref it ran from. The
    branch constraint for those runs therefore lives in the GitHub Environment's
    deployment branch policy (Settings → Environments → Deployment branches),
    not here. Configure it, or the branch is enforced only by the workflow's own
    trigger list. The branch subjects below remain exact either way.
  EOT
  type        = list(string)
  default     = null
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

# GitHub's immutable unique-ID subject claims (org setting). When enabled, the
# OIDC `sub` embeds these numeric ids, and a trust policy matching only
# owner/repo names is rejected with "Not authorized to perform
# sts:AssumeRoleWithWebIdentity". Look them up with:
#   gh api /repos/<owner>/<repo> --jq '{repo: .id, org: .owner.id}'
variable "github_org_id" {
  description = "Numeric GitHub org id. Empty disables the id-qualified subject."
  type        = string
  default     = ""
}

variable "github_repository_id" {
  description = "Numeric GitHub repository id. Empty disables the id-qualified subject."
  type        = string
  default     = ""
}
