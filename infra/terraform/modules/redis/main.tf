# =============================================================================
# ElastiCache — Redis 7 (cache, rate limiting, ephemeral call state)
# =============================================================================
# The application treats Redis as an optimization, never a source of truth,
# so a single node is an acceptable MVP default; raise replicas_per_node for
# automatic failover.

resource "aws_elasticache_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "this" {
  name        = "${var.name}-redis"
  description = "Redis access from the API service"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from allowed security groups"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name}-redis" }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.name
  description          = "RoofersLabs application cache"

  engine         = "redis"
  engine_version = var.engine_version
  node_type      = var.node_type
  port           = 6379

  num_cache_clusters         = 1 + var.replicas_per_node
  automatic_failover_enabled = var.replicas_per_node > 0
  multi_az_enabled           = var.replicas_per_node > 0

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # in-VPC only; the ioredis client uses redis:// URLs

  snapshot_retention_limit = var.snapshot_retention_days
  apply_immediately        = var.apply_immediately
}
