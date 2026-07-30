# =============================================================================
# Outputs — for operators of this optional environment
# =============================================================================
# Note what is absent: no distribution id, no bucket, no cluster, no service.
# There is nothing to deploy in this environment, and no output here can be
# mistaken for a deploy target.

output "environment" {
  value = var.environment
}

output "aws_region" {
  value = var.aws_region
}

output "db_endpoint" {
  description = "Development database hostname. Reachable only from developer_cidr_blocks."
  value       = module.rds.endpoint
}

output "db_identifier" {
  description = "Handle for snapshots and restores of the development database."
  value       = module.rds.identifier
}

output "database_secret_arn" {
  description = "Secrets Manager ARN holding the development DATABASE_URL."
  value       = module.secrets.database_secret_arn
}

output "app_secret_arn" {
  description = "Secrets Manager ARN holding development application credentials."
  value       = module.secrets.app_secret_arn
}

output "read_secrets_policy_arn" {
  description = "Grants read on this environment's secrets only. Attach to whichever identity needs them."
  value       = aws_iam_policy.read_dev_secrets.arn
}

output "clerk_publishable_key" {
  description = "Clerk development publishable key, consumed by the local web build."
  value       = var.clerk_publishable_key
}

output "vpc_id" {
  value = module.networking.vpc_id
}

# A reminder rendered by `terraform output`, so the operating model is visible
# from the environment itself and not only from documentation.
output "operator_notes" {
  value = <<-EOT
    This environment is OPTIONAL and is not used by local development.

    Local development runs Postgres and Redis in Docker and reads no AWS
    secret — see docs/local-development.md and `bun run setup`.

    What this root exists for: a shared development database, if one is ever
    wanted. Nothing consumes it today, so it can be left unapplied (it costs
    nothing unapplied) or destroyed without affecting any workflow.
  EOT
}
