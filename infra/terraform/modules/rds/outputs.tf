output "endpoint" {
  value = aws_db_instance.this.address
}

output "database_url" {
  description = "Prisma-ready connection string for the application."
  value       = "postgresql://${var.master_username}:${random_password.master.result}@${aws_db_instance.this.address}:5432/${var.database_name}?schema=public&connection_limit=10"
  sensitive   = true
}

output "security_group_id" {
  value = aws_security_group.this.id
}
