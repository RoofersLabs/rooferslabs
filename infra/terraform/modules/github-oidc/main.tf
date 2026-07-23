# =============================================================================
# GitHub Actions OIDC — deploy role for CI
# =============================================================================
# Lets the deploy workflows exchange a short-lived GitHub Actions ID token for
# AWS credentials, so no long-lived access key ever lives in GitHub secrets.
#
# The trust policy is scoped two ways, and BOTH must hold:
#   aud = sts.amazonaws.com          (the audience configure-aws-credentials requests)
#   sub = repo:<owner/repo>:ref:refs/heads/<branch>   for the allowed branches only
# Without the `sub` condition ANY repository on GitHub could assume this role.

data "aws_iam_openid_connect_provider" "existing" {
  count = var.create_oidc_provider ? 0 : 1

  url = "https://token.actions.githubusercontent.com"
}

# Since 2023 IAM validates token.actions.githubusercontent.com against its own
# trust store, so the thumbprint is vestigial — but IAM still populates one on
# create. Pinning a value here would rot the day GitHub rotates its intermediate
# CA, and leaving it unset would show that AWS-assigned value as drift on every
# plan, so it is left to AWS and explicitly ignored.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  lifecycle {
    ignore_changes = [thumbprint_list]
  }
}

locals {
  provider_arn = (var.create_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
  : data.aws_iam_openid_connect_provider.existing[0].arn)

  # This org has GitHub's immutable unique-ID subject claims enabled, so the
  # `sub` is NOT the documented `repo:OWNER/REPO:ref:...` — it carries the
  # numeric org and repo ids too:
  #   repo:RoofersLabs@305356388/rooferslabs@1301242105:ref:refs/heads/develop
  # Both forms are allowed: the id-qualified one is what GitHub sends today and
  # survives a rename, the plain one keeps this working if the org setting is
  # ever turned off. Neither uses a wildcard, so a lookalike org cannot match.
  id_qualified_repository = (var.github_org_id != "" && var.github_repository_id != ""
    ? "${local.repo_owner}@${var.github_org_id}/${local.repo_name}@${var.github_repository_id}"
  : "")

  repo_owner = split("/", var.github_repository)[0]
  repo_name  = split("/", var.github_repository)[1]

  allowed_subjects = concat(
    [for branch in var.allowed_branches : "repo:${var.github_repository}:ref:refs/heads/${branch}"],
    local.id_qualified_repository == "" ? [] : [
      for branch in var.allowed_branches :
      "repo:${local.id_qualified_repository}:ref:refs/heads/${branch}"
    ],
  )
}

data "aws_iam_policy_document" "assume" {
  statement {
    sid     = "GitHubActionsOIDC"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # StringLike (not StringEquals) only because the subject list is exact —
    # no wildcards are interpolated into it. Keep it that way.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.allowed_subjects
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name}-github-deploy"
  description        = "Assumed by GitHub Actions to deploy the SPA and the API."
  assume_role_policy = data.aws_iam_policy_document.assume.json

  # A deploy should never take longer than this; caps the blast radius of a
  # leaked session token.
  max_session_duration = 3600
}

# ---- Frontend: S3 sync + CloudFront invalidation ----------------------------

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "ListWebBucket"
    actions   = ["s3:ListBucket"]
    resources = [var.web_bucket_arn]
  }

  # DeleteObject is required: deploy-web.sh syncs with --delete so a removed
  # asset stops being served from the origin.
  statement {
    sid = "WriteWebBucket"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.web_bucket_arn}/*"]
  }

  # GetInvalidation backs `aws cloudfront wait invalidation-completed`.
  statement {
    sid = "InvalidateDistribution"
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
    ]
    resources = [var.cloudfront_distribution_arn]
  }

  # ---- Backend: ECR push + ECS rollout --------------------------------------

  # GetAuthorizationToken is account-wide by design — it takes no resource.
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = var.ecr_repository_arns
  }

  # force-new-deployment only — the task definition is owned by Terraform, so
  # CI never needs RegisterTaskDefinition or iam:PassRole.
  statement {
    sid = "EcsRollout"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
    ]
    resources = var.ecs_service_arns
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy-web-and-api"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
