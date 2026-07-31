# =============================================================================
# Outputs — everything the deploy scripts and the Cloudflare setup need
# =============================================================================
# Deliberately named exactly as in envs/production: the deploy scripts resolve
# their configuration from `terraform output` and only differ by which directory
# they point at. An output renamed here is a script that silently deploys with a
# missing value, so keep the two sets in step.

output "environment" {
  value = var.environment
}

output "root_domain" {
  value = var.root_domain
}

output "aws_region" {
  value = var.aws_region
}

# ---- Application URLs --------------------------------------------------------

output "web_url" {
  description = "The development SPA, served from its own CloudFront distribution."
  value       = "https://${local.environment_domain}"
}

output "api_url" {
  value = "https://${local.api_domain}"
}

# ---- Backend (ECS on the shared load balancer) -------------------------------

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "api_service_name" {
  value = module.api_service.service_name
}

output "api_log_group_name" {
  description = "CloudWatch log group the API writes to (db.sh reads one-off task output from it)."
  value       = module.observability.log_group_names["api"]
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "alb_dns_name" {
  description = "The SHARED load balancer, owned by envs/production. Point the Cloudflare CNAME for api.<env>.<domain> here."
  value       = data.aws_lb.shared.dns_name
}

output "api_routing_attached" {
  description = "False until enable_https = true has been applied: the certificate exists but the hostname is not routed yet."
  value       = module.alb_host.attached
}

output "acm_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only) so the API certificate can issue, then re-apply with enable_https = true."
  value       = module.alb_host.certificate_validation_records
}

# ---- Frontend (S3 + CloudFront) ----------------------------------------------

output "web_bucket" {
  description = "S3 bucket for the built SPA (deploy-web.sh syncs here)."
  value       = module.frontend.bucket_name
}

output "web_distribution_id" {
  description = "CloudFront distribution id (deploy-web.sh invalidates this)."
  value       = module.frontend.distribution_id
}

output "web_cloudfront_domain" {
  description = "CloudFront domain — create the Cloudflare CNAME for dev.<domain> pointing here."
  value       = module.frontend.distribution_domain_name
}

output "web_certificate_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only), wait for the cert to issue, then apply with enable_web_custom_domain = true."
  value       = module.frontend.certificate_validation_records
}

output "clerk_publishable_key" {
  description = "Consumed by deploy-web.sh as the SPA build-time key. Development instance only."
  value       = var.clerk_publishable_key
}

# ---- Storage and queues ------------------------------------------------------

output "s3_buckets" {
  value = module.s3.bucket_names
}

output "sqs_queue_url" {
  value = module.sqs.queue_url
}

output "sqs_dead_letter_queue_url" {
  value = module.sqs.dead_letter_queue_url
}

# ---- Integrations ------------------------------------------------------------

output "twilio_voice_webhook" {
  description = "Set as the Voice webhook (POST) on the DEVELOPMENT Twilio numbers only."
  value       = "https://${local.api_domain}/v1/telephony/incoming"
}

output "twilio_status_callback" {
  value = "https://${local.api_domain}/v1/telephony/status"
}

output "paddle_webhook_url" {
  description = "Point a Paddle SANDBOX notification destination here. Never a live destination."
  value       = "https://${local.api_domain}/v1/billing/webhook/paddle"
}

output "github_deploy_role_arn" {
  description = "Set as AWS_DEPLOY_ROLE_ARN on the GitHub `development` environment (Settings → Environments)."
  value       = module.github_oidc.deploy_role_arn
}

# ---- Cloudflare --------------------------------------------------------------

output "cloudflare_dns_records" {
  description = "The records to create by hand in Cloudflare. Terraform manages no DNS."
  value = [
    {
      type    = "CNAME"
      name    = var.environment_subdomain
      content = module.frontend.distribution_domain_name
      proxy   = "Proxied (orange cloud)"
      serves  = "https://${local.environment_domain}"
    },
    {
      type    = "CNAME"
      name    = "${var.api_subdomain}.${var.environment_subdomain}"
      content = data.aws_lb.shared.dns_name
      proxy   = "Proxied (orange cloud)"
      serves  = "https://${local.api_domain}"
    },
  ]
}
