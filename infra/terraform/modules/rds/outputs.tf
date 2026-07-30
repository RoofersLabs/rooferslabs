output "endpoint" {
  value = aws_db_instance.this.address
}

output "database_url" {
  description = "Prisma-ready connection string for the application."
  # A public instance runs with rds.force_ssl = 1 and rejects plaintext, so the
  # URL has to ask for TLS or every client fails with an error that says nothing
  # about TLS. The private production instance keeps the exact string it already
  # has, so this adds no diff to its state.
  value = join("", [
    "postgresql://${var.master_username}:${random_password.master.result}",
    "@${aws_db_instance.this.address}:5432/${var.database_name}",
    "?schema=public&connection_limit=10",
    var.publicly_accessible ? "&sslmode=require" : "",
  ])
  sensitive = true
}

output "security_group_id" {
  value = aws_security_group.this.id
}

output "identifier" {
  description = "DB instance identifier — the handle for snapshots, restores, and CloudWatch dimensions."
  value       = aws_db_instance.this.identifier
}
