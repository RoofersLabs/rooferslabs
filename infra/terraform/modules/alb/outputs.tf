output "alb_dns_name" {
  description = "Point Cloudflare CNAMEs for the api/app hostnames here."
  value       = aws_lb.this.dns_name
}

output "alb_arn_suffix" {
  value = aws_lb.this.arn_suffix
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "api_target_group_arn" {
  value = aws_lb_target_group.api.arn
}

output "web_target_group_arn" {
  value = aws_lb_target_group.web.arn
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
