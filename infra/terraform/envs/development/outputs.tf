# =============================================================================
# Outputs — consumed by infra/scripts/dev-env.sh to generate local .env files
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
  description = "Attach to the identity that runs infra/scripts/dev-env.sh. Grants read on development secrets only."
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
output "local_development_notes" {
  value = <<-EOT
    Development runs on localhost. Nothing here is deployed.

      Redis         docker compose -f docker/docker-compose.yml up -d redis
      Config        infra/scripts/dev-env.sh      (writes the local .env files)
      API           npm run dev:api               (http://localhost:4000)
      Web           npm run dev:web               (http://localhost:5173)

    The database is reachable only from the addresses in developer_cidr_blocks.
    If connections start timing out, your public address most likely changed:

      curl -s https://checkip.amazonaws.com
  EOT
}
