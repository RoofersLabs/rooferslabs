# =============================================================================
# Outputs — everything the deploy script and Cloudflare setup need
# =============================================================================

output "alb_dns_name" {
  description = "Create Cloudflare CNAMEs: api.<domain> and app.<domain> → this hostname."
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

output "web_service_name" {
  value = module.web_service.service_name
}

output "api_url" {
  value = "https://${var.api_subdomain}.${var.root_domain}"
}

output "app_url" {
  value = "https://${var.app_subdomain}.${var.root_domain}"
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
