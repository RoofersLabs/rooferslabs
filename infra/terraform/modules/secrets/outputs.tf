output "database_secret_arn" {
  value = aws_secretsmanager_secret.database.arn
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}
