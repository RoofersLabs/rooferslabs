# =============================================================================
# RoofersLabs — production environment
# =============================================================================
# Composes the reusable modules into the backend stack:
#   VPC → ALB (+ACM) → ECR → RDS → Redis → S3 → SQS → Secrets → IAM
#   → CloudWatch → ECS Fargate (api)
#
# The frontend (apps/web) is hosted on Vercel — see /vercel.json and
# docs/13_Deployment_Guide.md. This stack serves the API only.
#
# See infra/terraform/README.md for the from-scratch walkthrough.

data "aws_caller_identity" "current" {}

locals {
  name       = "rooferslabs-${var.environment}"
  api_domain = "${var.api_subdomain}.${var.root_domain}"
  app_domain = "${var.app_subdomain}.${var.root_domain}"
  api_url    = "https://${local.api_domain}"
  app_url    = "https://${local.app_domain}"
}

# ---- Networking -----------------------------------------------------------------

module "networking" {
  source = "../../modules/networking"

  name = local.name
}

# ---- Container registry -----------------------------------------------------------

module "ecr" {
  source = "../../modules/ecr"

  name         = "rooferslabs"
  repositories = ["api"]
}

# ---- Load balancer -----------------------------------------------------------------

module "alb" {
  source = "../../modules/alb"

  name              = local.name
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  api_domain        = local.api_domain
  enable_https      = var.enable_https
}

# ---- API service security group ---------------------------------------------------
# Created here (not inside the ecs-service module) so RDS and Redis can
# whitelist it without a module dependency cycle.

resource "aws_security_group" "api_service" {
  name        = "${local.name}-api-svc"
  description = "Ingress from the ALB to the API service"
  vpc_id      = module.networking.vpc_id

  ingress {
    description     = "API port from the ALB"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [module.alb.alb_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-api-svc" }
}

# ---- Data stores -----------------------------------------------------------------

module "rds" {
  source = "../../modules/rds"

  name                       = local.name
  vpc_id                     = module.networking.vpc_id
  private_subnet_ids         = module.networking.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  instance_class             = var.db_instance_class
  multi_az                   = var.db_multi_az
  deletion_protection        = var.db_deletion_protection
}

module "redis" {
  source = "../../modules/redis"

  name                       = local.name
  vpc_id                     = module.networking.vpc_id
  private_subnet_ids         = module.networking.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  node_type                  = var.redis_node_type
}

module "s3" {
  source = "../../modules/s3"

  name = "${local.name}-${data.aws_caller_identity.current.account_id}"
}

module "sqs" {
  source = "../../modules/sqs"

  name = local.name
}

# ---- Secrets -----------------------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"

  name         = local.name
  database_url = module.rds.database_url

  app_secrets = merge(
    {
      CLERK_SECRET_KEY   = var.clerk_secret_key
      OPENAI_API_KEY     = var.openai_api_key
      TWILIO_ACCOUNT_SID = var.twilio_account_sid
      TWILIO_AUTH_TOKEN  = var.twilio_auth_token
    },
    var.clerk_webhook_secret != "" ? { CLERK_WEBHOOK_SECRET = var.clerk_webhook_secret } : {},
    var.vapid_private_key != "" ? { VAPID_PRIVATE_KEY = var.vapid_private_key } : {},
  )
}

# ---- IAM -----------------------------------------------------------------------------

module "iam" {
  source = "../../modules/iam"

  name = local.name
  secret_arns = [
    module.secrets.database_secret_arn,
    module.secrets.app_secret_arn,
  ]
  s3_bucket_arns = values(module.s3.bucket_arns)
  sqs_queue_arns = [module.sqs.queue_arn, module.sqs.dead_letter_queue_arn]
}

# ---- CloudWatch ------------------------------------------------------------------------

module "observability" {
  source = "../../modules/observability"

  name               = local.name
  services           = ["api"]
  log_retention_days = var.log_retention_days
  alarm_email        = var.alarm_email
  alb_arn_suffix     = module.alb.alb_arn_suffix
  cluster_name       = local.name
  api_service_name   = "${local.name}-api"
}

# ---- ECS ------------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

module "api_service" {
  source = "../../modules/ecs-service"

  name                  = "${local.name}-api"
  region                = var.aws_region
  cluster_arn           = aws_ecs_cluster.this.arn
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  alb_security_group_id = module.alb.alb_security_group_id
  create_security_group = false # plan-time literal; the SG below is created in this root
  security_group_id     = aws_security_group.api_service.id
  target_group_arn      = module.alb.api_target_group_arn

  container_name       = "api"
  container_port       = 4000
  image_repository_url = module.ecr.repository_urls["api"]
  cpu                  = var.api_cpu
  memory               = var.api_memory
  desired_count        = var.api_desired_count

  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn
  log_group_name     = module.observability.log_group_names["api"]

  environment = {
    NODE_ENV                = "production"
    API_PORT                = "4000"
    API_PUBLIC_URL          = local.api_url
    WEB_PUBLIC_URL          = local.app_url
    CORS_ORIGINS            = local.app_url
    REDIS_URL               = module.redis.redis_url
    LOG_LEVEL               = "info"
    OPENAI_REALTIME_MODEL   = var.openai_realtime_model
    OPENAI_RESPONSES_MODEL  = var.openai_responses_model
    OPENAI_EMBEDDING_MODEL  = var.openai_embedding_model
    TWILIO_MEDIA_STREAM_URL = "wss://${local.api_domain}/v1/telephony/media-stream"
    CLERK_PUBLISHABLE_KEY   = var.clerk_publishable_key
    VAPID_PUBLIC_KEY        = var.vapid_public_key
    VAPID_SUBJECT           = var.vapid_subject
    AWS_REGION              = var.aws_region
    S3_BUCKET_RECORDINGS    = module.s3.bucket_names["recordings"]
    S3_BUCKET_UPLOADS       = module.s3.bucket_names["uploads"]
    # Queue is provisioned and permitted; consumers arrive in a later release.
    SQS_QUEUE_URL          = module.sqs.queue_url
    BACKGROUND_JOBS_INLINE = "true"
  }

  secrets = merge(
    {
      DATABASE_URL       = "${module.secrets.database_secret_arn}:DATABASE_URL::"
      CLERK_SECRET_KEY   = "${module.secrets.app_secret_arn}:CLERK_SECRET_KEY::"
      OPENAI_API_KEY     = "${module.secrets.app_secret_arn}:OPENAI_API_KEY::"
      TWILIO_ACCOUNT_SID = "${module.secrets.app_secret_arn}:TWILIO_ACCOUNT_SID::"
      TWILIO_AUTH_TOKEN  = "${module.secrets.app_secret_arn}:TWILIO_AUTH_TOKEN::"
    },
    var.clerk_webhook_secret != ""
    ? { CLERK_WEBHOOK_SECRET = "${module.secrets.app_secret_arn}:CLERK_WEBHOOK_SECRET::" }
    : {},
    var.vapid_private_key != ""
    ? { VAPID_PRIVATE_KEY = "${module.secrets.app_secret_arn}:VAPID_PRIVATE_KEY::" }
    : {},
  )
}

