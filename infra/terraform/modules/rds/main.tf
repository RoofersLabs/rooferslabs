# =============================================================================
# RDS — PostgreSQL 16 for the application database
# =============================================================================
# The master password is generated here and surfaced only through the
# database_url output (marked sensitive), which the root module stores in
# Secrets Manager for the ECS task. Nothing is ever written to disk.

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids

  tags = { Name = var.name }
}

resource "aws_security_group" "this" {
  name = "${var.name}-rds"
  # Immutable in AWS — editing this string replaces the security group, which
  # detaches the running database from it. Left exactly as production has it.
  description = "PostgreSQL access from the API service"
  vpc_id      = var.vpc_id

  # Both rules are dynamic so each can be absent entirely. A production
  # instance has security-group sources and no CIDRs; a local-development
  # instance has the operator's CIDR and no security groups, because there is no
  # in-VPC compute to name. An inline block with an empty source list is not a
  # rule AWS will accept, so "absent" has to mean zero blocks, not an empty one.
  dynamic "ingress" {
    for_each = length(var.allowed_security_group_ids) > 0 ? [1] : []
    content {
      description     = "PostgreSQL from allowed security groups"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = var.allowed_security_group_ids
    }
  }

  # The entire access boundary for a publicly-addressable instance. Keep it to
  # single addresses (a.b.c.d/32); 0.0.0.0/0 here puts the database on the open
  # internet behind nothing but a password.
  dynamic "ingress" {
    for_each = length(var.allowed_cidr_blocks) > 0 ? [1] : []
    content {
      description = "PostgreSQL from allowed CIDRs (operator workstations)"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = var.allowed_cidr_blocks
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-rds" }
}

# A reachable-from-the-internet endpoint must refuse plaintext, or the password
# and every row crosses the public internet in the clear. rds.force_ssl makes
# the server reject non-TLS connections outright rather than trusting each
# client to ask for one.
#
# Only created when the instance is public: attaching a parameter group to the
# existing private instance would reboot it for no security gain.
resource "aws_db_parameter_group" "this" {
  count = var.publicly_accessible ? 1 : 0

  name_prefix = "${var.name}-pg16-"
  family      = "postgres16"
  description = "Force TLS for ${var.name}"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "random_password" "master" {
  length  = 32
  special = false # keep the DATABASE_URL free of URL-encoding surprises
}

resource "aws_db_instance" "this" {
  identifier = var.name

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = var.publicly_accessible
  multi_az               = var.multi_az
  parameter_group_name   = var.publicly_accessible ? aws_db_parameter_group.this[0].name : null

  backup_retention_period   = var.backup_retention_days
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = var.deletion_protection ? "${var.name}-final" : null

  auto_minor_version_upgrade = true
  apply_immediately          = var.apply_immediately

  performance_insights_enabled = var.performance_insights
}
