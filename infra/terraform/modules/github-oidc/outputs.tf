output "deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable."
  value       = aws_iam_role.deploy.arn
}

output "oidc_provider_arn" {
  value = local.provider_arn
}
