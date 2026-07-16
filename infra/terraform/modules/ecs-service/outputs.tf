output "service_name" {
  value = aws_ecs_service.this.name
}

output "security_group_id" {
  value = local.service_security_group_id
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.this.arn
}
