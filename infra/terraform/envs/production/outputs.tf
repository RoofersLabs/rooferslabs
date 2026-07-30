# =============================================================================
# Outputs — everything the deploy scripts and DNS setup need
# =============================================================================
# Re-exported from modules/platform so both environments answer `terraform
# output` identically and the deploy scripts need no per-environment branch.

output "environment" {
  value = module.platform.environment
}

output "aws_region" {
  value = module.platform.aws_region
}

# ---- DNS ---------------------------------------------------------------------

output "alb_dns_name" {
  description = "Create the Cloudflare CNAME: api.<domain> → this hostname. (The apex/www point at CloudFront — see web_cloudfront_domain — not the ALB.)"
  value       = module.platform.alb_dns_name
}

output "acm_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only) so the HTTPS certificate can issue, then re-apply with enable_https = true."
  value       = module.platform.acm_validation_records
}

output "web_cloudfront_domain" {
  description = "CloudFront domain — create the Cloudflare CNAMEs for apex + www pointing here."
  value       = module.platform.web_cloudfront_domain
}

output "web_certificate_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only), wait for the cert to issue, then apply with enable_web_custom_domain = true."
  value       = module.platform.web_certificate_validation_records
}

output "web_url" {
  description = "Canonical public site (apex), served from CloudFront."
  value       = module.platform.web_url
}

output "api_url" {
  value = module.platform.api_url
}

output "admin_url" {
  description = "Internal admin portal origin, allowed in the API's CORS list."
  value       = module.platform.admin_url
}

# ---- Deploy targets ----------------------------------------------------------

output "ecr_repository_urls" {
  value = module.platform.ecr_repository_urls
}

output "ecs_cluster_name" {
  value = module.platform.ecs_cluster_name
}

output "api_service_name" {
  value = module.platform.api_service_name
}

output "web_bucket" {
  description = "S3 bucket for the built SPA (deploy-web.sh syncs here)."
  value       = module.platform.web_bucket
}

output "web_bucket_arn" {
  value = module.platform.web_bucket_arn
}

output "web_distribution_id" {
  description = "CloudFront distribution id (deploy-web.sh invalidates this)."
  value       = module.platform.web_distribution_id
}

output "github_deploy_role_arn" {
  description = "Set as the PRODUCTION GitHub Environment's AWS_DEPLOY_ROLE_ARN variable. Trusts `main` only."
  value       = module.platform.github_deploy_role_arn
}

# ---- Application configuration ------------------------------------------------

output "clerk_publishable_key" {
  description = "Consumed by the deploy script as the web build arg."
  value       = module.platform.clerk_publishable_key
}

output "s3_buckets" {
  value = module.platform.s3_buckets
}

output "sqs_queue_url" {
  description = "Background jobs queue (provisioned; consumers arrive in a later release)."
  value       = module.platform.sqs_queue_url
}

output "sqs_dead_letter_queue_url" {
  value = module.platform.sqs_dead_letter_queue_url
}

# ---- Integrations --------------------------------------------------------------

output "twilio_voice_webhook" {
  description = "Set as the Voice webhook (POST) on each production Twilio number."
  value       = module.platform.twilio_voice_webhook
}

output "twilio_status_callback" {
  description = "Set as the call status callback (POST) on each production Twilio number."
  value       = module.platform.twilio_status_callback
}

output "paddle_webhook_url" {
  description = "Register on the Paddle LIVE account as the notification destination."
  value       = module.platform.paddle_webhook_url
}

# ---- Secrets (ARNs only) -------------------------------------------------------

output "database_secret_arn" {
  value = module.platform.database_secret_arn
}

output "app_secret_arn" {
  value = module.platform.app_secret_arn
}

# ---- Networking (consumed by the development root) ---------------------------
# Development attaches to this VPC. Exported so its root can read the ids
# without hardcoding them; it never writes to any of these.

output "vpc_id" {
  value = module.networking.vpc_id
}
