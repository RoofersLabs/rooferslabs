output "target_group_arn" {
  value = aws_lb_target_group.this.arn
}

output "target_group_arn_suffix" {
  description = "CloudWatch dimension value, so alarms can measure this hostname rather than everything the shared load balancer serves."
  value       = aws_lb_target_group.this.arn_suffix
}

output "certificate_arn" {
  value = aws_acm_certificate.this.arn
}

output "certificate_validation_records" {
  description = "CNAME records to create in Cloudflare (DNS-only/grey cloud) so the ACM certificate can issue."
  value = [
    for dvo in aws_acm_certificate.this.domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ]
}

output "attached" {
  description = "Whether TLS for this hostname can complete yet — i.e. whether the certificate has been attached (phase 2). The routing rule exists either way."
  value       = var.enable_https
}

output "listener_rule_arn" {
  value = aws_lb_listener_rule.host.arn
}
