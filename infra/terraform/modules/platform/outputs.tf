# =============================================================================
# platform — outputs
# =============================================================================
# Everything the deploy scripts, the CI workflows, and the DNS setup need. The
# environment roots re-export these verbatim, so `terraform output` reads the
# same in both environments and the deploy scripts stay environment-agnostic.

output "environment" {
  value = var.environment
}

output "aws_region" {
  value = var.aws_region
}

# ---- DNS ---------------------------------------------------------------------

output "alb_dns_name" {
  description = "Create the DNS CNAME: <api_domain> → this hostname. (The web hostnames point at CloudFront, not the ALB.)"
  value       = module.alb.alb_dns_name
}

output "acm_validation_records" {
  description = "Add these CNAMEs (DNS-only) so the ALB's HTTPS certificate can issue, then re-apply with enable_https = true."
  value       = module.alb.certificate_validation_records
}

output "web_cloudfront_domain" {
  description = "CloudFront domain — create the DNS CNAME for this environment's web hostname(s) pointing here."
  value       = module.frontend.distribution_domain_name
}

output "web_certificate_validation_records" {
  description = "Add these CNAMEs (DNS-only), wait for ISSUED, then apply with enable_web_custom_domain = true."
  value       = module.frontend.certificate_validation_records
}

output "web_url" {
  value = local.web_url
}

output "api_url" {
  value = local.api_url
}

output "admin_url" {
  description = "Admin portal origin, or empty when this environment has no admin host."
  value       = var.admin_domain != "" ? "https://${var.admin_domain}" : ""
}

# ---- Deploy targets ----------------------------------------------------------

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "api_service_name" {
  value = module.api_service.service_name
}

output "web_bucket" {
  description = "S3 bucket for the built SPA (deploy-web.sh syncs here)."
  value       = module.frontend.bucket_name
}

output "web_bucket_arn" {
  value = module.frontend.bucket_arn
}

output "web_distribution_id" {
  description = "CloudFront distribution id (deploy-web.sh invalidates this)."
  value       = module.frontend.distribution_id
}

output "github_deploy_role_arn" {
  description = "Set as this environment's AWS_DEPLOY_ROLE_ARN GitHub Actions variable."
  value       = module.github_oidc.deploy_role_arn
}

# ---- Application configuration ------------------------------------------------

output "launch_mode" {
  description = "Private-beta state. Consumed by deploy-web.sh as the SPA build-time fallback."
  value       = var.launch_mode
}

output "clerk_publishable_key" {
  description = "Consumed by deploy-web.sh as the SPA build argument."
  value       = var.clerk_publishable_key
}

output "s3_buckets" {
  value = module.s3.bucket_names
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "sqs_dead_letter_queue_url" {
  value = module.sqs.dead_letter_queue_url
}

# ---- Integrations --------------------------------------------------------------

output "twilio_voice_webhook" {
  description = "Set as the Voice webhook (POST) on this environment's Twilio numbers."
  value       = "${local.api_url}/v1/telephony/incoming"
}

output "twilio_status_callback" {
  description = "Set as the call status callback (POST) on this environment's Twilio numbers."
  value       = "${local.api_url}/v1/telephony/status"
}

output "paddle_webhook_url" {
  description = "Register as the Paddle notification destination for this environment's Paddle account (sandbox for development, live for production)."
  value       = "${local.api_url}/v1/billing/webhook/paddle"
}

# ---- Secrets (ARNs only; values are never surfaced) --------------------------

output "database_secret_arn" {
  description = "Secrets Manager ARN holding DATABASE_URL for this environment."
  value       = module.secrets.database_secret_arn
}

output "app_secret_arn" {
  description = "Secrets Manager ARN holding this environment's application credentials."
  value       = module.secrets.app_secret_arn
}
