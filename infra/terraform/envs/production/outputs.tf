# =============================================================================
# Outputs — everything the deploy script and Cloudflare setup need
# =============================================================================

output "alb_dns_name" {
  description = "Create the Cloudflare CNAME: api.<domain> → this hostname. (The apex/www point at CloudFront — see web_cloudfront_domain — not the ALB.)"
  value       = module.alb.alb_dns_name
}

output "acm_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only) so the HTTPS certificate can issue, then re-apply with enable_https = true."
  value       = module.alb.certificate_validation_records
}

output "ecr_repository_urls" {
  value = module.ecr.repository_urls
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "api_service_name" {
  value = module.api_service.service_name
}

output "api_url" {
  value = "https://${var.api_subdomain}.${var.root_domain}"
}

output "web_url" {
  description = "Canonical public site (apex), served from CloudFront. Point the Cloudflare CNAME(s) at web_cloudfront_domain."
  value       = "https://${var.root_domain}"
}

output "admin_url" {
  description = "Planned internal admin portal origin. Allowed in the API's CORS list; no infrastructure is provisioned for it yet."
  value       = "https://${var.admin_subdomain}.${var.root_domain}"
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
  description = "CloudFront domain — create the Cloudflare CNAMEs for apex + www pointing here."
  value       = module.frontend.distribution_domain_name
}

output "web_certificate_validation_records" {
  description = "Add these CNAMEs in Cloudflare (DNS-only), wait for the cert to issue, then apply with enable_web_custom_domain = true."
  value       = module.frontend.certificate_validation_records
}

output "sqs_queue_url" {
  description = "Background jobs queue (provisioned; consumers arrive in a later release)."
  value       = module.sqs.queue_url
}

output "sqs_dead_letter_queue_url" {
  value = module.sqs.dead_letter_queue_url
}

output "twilio_voice_webhook" {
  description = "Set as the Voice webhook (POST) on each Twilio number."
  value       = "https://${var.api_subdomain}.${var.root_domain}/v1/telephony/incoming"
}

output "twilio_status_callback" {
  description = "Set as the call status callback (POST) on each Twilio number."
  value       = "https://${var.api_subdomain}.${var.root_domain}/v1/telephony/status"
}

output "clerk_publishable_key" {
  description = "Consumed by the deploy script as the web image build arg."
  value       = var.clerk_publishable_key
}

output "aws_region" {
  value = var.aws_region
}

output "s3_buckets" {
  value = module.s3.bucket_names
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN GitHub Actions variable (Settings → Secrets and variables → Actions)."
  value       = module.github_oidc.deploy_role_arn
}

output "web_bucket_arn" {
  value = module.frontend.bucket_arn
}
