# =============================================================================
# Secrets Manager — application secrets consumed by the ECS task definitions
# =============================================================================
# Two secrets:
#   <name>/database — the generated RDS connection string (from the rds module)
#   <name>/app      — external credentials supplied as Terraform variables
#                     (Clerk, OpenAI, Twilio, VAPID), stored as one JSON object
#                     so ECS can extract individual keys with valueFrom.

resource "aws_secretsmanager_secret" "database" {
  name                    = "${var.name}/database"
  description             = "RoofersLabs database connection string"
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id     = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({ DATABASE_URL = var.database_url })
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.name}/app"
  description             = "RoofersLabs external service credentials"
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(var.app_secrets)
}
