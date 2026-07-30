# =============================================================================
# platform — one complete RoofersLabs environment
# =============================================================================
# Everything an environment owns, above the VPC:
#   ALB (+ACM) → ECR → RDS → Redis → S3 → SQS → Secrets → IAM → CloudWatch
#   → ECS Fargate (api) → CloudFront SPA
#
# Both envs/production and envs/development call this module. That is the point:
# a second root that re-composed these modules by hand would drift from the
# first within a release or two, and the whole value of a staging environment is
# that it is the same shape as production. Per-environment difference is
# expressed as arguments here, never as a divergent copy of the composition.
#
# Networking is deliberately NOT in this module. Production creates its own VPC
# (modules/networking); development attaches to it (modules/networking-attached).
# Hoisting that decision to the root keeps this module indifferent to which
# state owns the VPC, and — because the production VPC resources keep their
# existing state addresses — keeps this refactor a no-op for production.

data "aws_caller_identity" "current" {}

locals {
  name = "rooferslabs-${var.environment}"

  api_url  = "https://${var.api_domain}"
  web_url  = "https://${var.web_domain}"
  is_prod  = var.environment == "production"
  is_https = var.enable_https

  # Every origin the API will answer CORS for. Built from the hostnames this
  # environment actually serves — a development origin can never appear in the
  # production list, because production is never handed one.
  cors_origins = join(",", distinct(concat(
    [local.web_url],
    [for d in var.web_domain_aliases : "https://${d}"],
    var.admin_domain != "" ? ["https://${var.admin_domain}"] : [],
  )))
}

# ---- Container registry ------------------------------------------------------
# Per-environment by default. A shared repository would let an image built from
# `develop` be pulled by the production service — the tag is the only thing
# standing between the two, and a tag is not an access boundary.

module "ecr" {
  source = "../ecr"

  name         = var.ecr_namespace
  repositories = ["api"]
}

# ---- Load balancer -----------------------------------------------------------

module "alb" {
  source = "../alb"

  name              = local.name
  vpc_id            = var.vpc_id
  public_subnet_ids = var.public_subnet_ids
  api_domain        = var.api_domain
  enable_https      = local.is_https
}

# ---- API service security group ----------------------------------------------
# Created here (not inside the ecs-service module) so RDS and Redis can
# whitelist it without a module dependency cycle.
#
# This group is the environment's real isolation boundary when the VPC is
# shared. It names only this environment's ALB group as a source, and the RDS
# and Redis groups below name only this group — so nothing in a sibling
# environment can reach this environment's data stores, whatever the routing
# table says.

resource "aws_security_group" "api_service" {
  name = "${local.name}-api-svc"
  # Verbatim from the pre-refactor configuration, and must stay that way: a
  # security group description is immutable, so editing this string replaces the
  # group — briefly cutting the running API off from RDS and Redis. The name
  # already carries the environment.
  description = "Ingress from the ALB to the API service"
  vpc_id      = var.vpc_id

  ingress {
    # Verbatim from the pre-refactor configuration. (Also: no apostrophes — AWS
    # validates rule descriptions against a character set that excludes them.)
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

# ---- Data stores -------------------------------------------------------------

module "rds" {
  source = "../rds"

  name                       = local.name
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  instance_class             = var.db_instance_class
  multi_az                   = var.db_multi_az
  deletion_protection        = var.db_deletion_protection
}

module "redis" {
  source = "../redis"

  name                       = local.name
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  node_type                  = var.redis_node_type
}

module "s3" {
  source = "../s3"

  name = "${local.name}-${data.aws_caller_identity.current.account_id}"
}

module "sqs" {
  source = "../sqs"

  name = local.name
}

# ---- Frontend (S3 + CloudFront + OAC) ----------------------------------------
# The Vite SPA is uploaded by infra/scripts/deploy-web.sh; this owns the CDN.
#
# One distribution per environment, each with its own cache policy, response
# headers policy, CSP, and invalidation surface. Nothing is shared, so a
# development invalidation cannot touch a production cache and a development CSP
# can be loosened for debugging without weakening production.

module "frontend" {
  source = "../frontend-cdn"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name        = local.name
  bucket_name = var.web_bucket_name

  domain_aliases = concat(
    [var.web_domain],
    var.web_domain_aliases,
    var.enable_admin_alias && var.admin_domain != "" ? [var.admin_domain] : [],
  )

  # Requested a stage earlier than the alias is attached, so the certificate can
  # validate while the live site keeps serving on the one it already has.
  certificate_domains = concat(
    [var.web_domain],
    var.web_domain_aliases,
    var.request_admin_certificate && var.admin_domain != "" ? [var.admin_domain] : [],
  )

  # Issued under this environment's own hostname, never the shared apex.
  cert_primary_domain = var.web_domain

  admin_host              = var.enable_admin_alias ? var.admin_domain : ""
  root_domain             = var.root_domain
  clerk_frontend_host     = var.clerk_frontend_host
  api_domain              = var.api_domain
  enable_custom_domain    = var.enable_web_custom_domain
  price_class             = var.web_price_class
  content_security_policy = var.web_content_security_policy
}

# ---- Secrets -----------------------------------------------------------------

# Turning the payment wall on without the credentials to enforce it would boot an
# API that rejects every customer, so fail the plan instead of the deployment.
locals {
  billing_credentials_present = (
    var.payment_provider == "paddle"
    ? (
      var.paddle_api_key != "" &&
      var.paddle_client_token != "" &&
      var.paddle_webhook_secret != "" &&
      var.paddle_price_starter_monthly != "" &&
      var.paddle_price_professional_monthly != ""
    )
    : (
      var.stripe_secret_key != "" &&
      var.stripe_webhook_secret != "" &&
      var.stripe_price_starter != "" &&
      var.stripe_price_professional != ""
    )
  )
}

resource "terraform_data" "payments_config_check" {
  input = "${var.payments_enabled}-${var.payment_provider}"

  lifecycle {
    precondition {
      condition = !var.payments_enabled || local.billing_credentials_present
      error_message = join(" ", [
        "payments_enabled = true with payment_provider = \"paddle\" requires paddle_api_key,",
        "paddle_client_token, paddle_webhook_secret, paddle_price_starter_monthly and",
        "paddle_price_professional_monthly. With payment_provider = \"stripe\" it requires",
        "stripe_secret_key, stripe_webhook_secret, stripe_price_starter and",
        "stripe_price_professional. Set payments_enabled = false to run without billing.",
      ])
    }
  }
}

# Production must bill through Paddle's live system, and development must never
# reach it. Both directions are a plan-time failure rather than a code review
# someone forgets to do: a production apply that still points at sandbox takes
# no real money, and a development apply that points at live takes real money
# from whoever is testing.
resource "terraform_data" "paddle_environment_check" {
  input = "${var.environment}-${var.paddle_environment}"

  lifecycle {
    precondition {
      condition = (
        var.allow_paddle_environment_mismatch ||
        !var.payments_enabled ||
        var.payment_provider != "paddle" ||
        (local.is_prod ? var.paddle_environment == "production" : var.paddle_environment == "sandbox")
      )
      error_message = join(" ", [
        "Paddle environment does not match the deployment environment.",
        "production must use paddle_environment = \"production\" (live keys, live catalogue);",
        "every other environment must use \"sandbox\".",
        "Set payments_enabled = false to run this environment without billing at all,",
        "or allow_paddle_environment_mismatch = true to acknowledge the deviation.",
      ])
    }
  }
}

# Clerk keys are per-instance and must not cross environments: a production
# deployment carrying pk_test_/sk_test_ is authenticating live customers against
# Clerk's development instance, which has no production user directory, weaker
# rate limits, and a shared demo sign-in surface.
resource "terraform_data" "clerk_instance_check" {
  input = "${var.environment}-${substr(var.clerk_publishable_key, 0, 8)}"

  lifecycle {
    precondition {
      condition = (
        var.allow_clerk_instance_mismatch ||
        (local.is_prod
          ? startswith(var.clerk_publishable_key, "pk_live_") && startswith(var.clerk_secret_key, "sk_live_")
          : startswith(var.clerk_publishable_key, "pk_test_") && startswith(var.clerk_secret_key, "sk_test_")
        )
      )
      error_message = join(" ", [
        "Clerk keys do not match the deployment environment.",
        "production requires the Clerk production instance (pk_live_… / sk_live_…);",
        "every other environment requires the development instance (pk_test_… / sk_test_…).",
        "Set allow_clerk_instance_mismatch = true to acknowledge a known, temporary deviation.",
      ])
    }
  }
}

module "secrets" {
  source = "../secrets"

  name         = local.name
  database_url = module.rds.database_url

  # Namespaced by local.name, so production and development write to entirely
  # separate secrets (rooferslabs-production/app vs rooferslabs-development/app)
  # with separate IAM policies. No secret is shared, and no environment's task
  # role is granted read on the other's ARNs.
  app_secrets = merge(
    {
      CLERK_SECRET_KEY   = var.clerk_secret_key
      OPENAI_API_KEY     = var.openai_api_key
      TWILIO_ACCOUNT_SID = var.twilio_account_sid
      TWILIO_AUTH_TOKEN  = var.twilio_auth_token
    },
    var.payments_enabled && var.payment_provider == "paddle" ? {
      PADDLE_API_KEY        = var.paddle_api_key
      PADDLE_WEBHOOK_SECRET = var.paddle_webhook_secret
      PADDLE_CLIENT_TOKEN   = var.paddle_client_token
    } : {},
    var.payments_enabled && var.payment_provider == "stripe" ? {
      STRIPE_SECRET_KEY     = var.stripe_secret_key
      STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
    } : {},
    var.clerk_webhook_secret != "" ? { CLERK_WEBHOOK_SECRET = var.clerk_webhook_secret } : {},
    var.vapid_private_key != "" ? { VAPID_PRIVATE_KEY = var.vapid_private_key } : {},
  )
}

# ---- IAM ---------------------------------------------------------------------

module "iam" {
  source = "../iam"

  name = local.name
  secret_arns = [
    module.secrets.database_secret_arn,
    module.secrets.app_secret_arn,
  ]
  s3_bucket_arns = values(module.s3.bucket_arns)
  sqs_queue_arns = [module.sqs.queue_arn, module.sqs.dead_letter_queue_arn]
}

# ---- CI deploy role (GitHub Actions OIDC) ------------------------------------
# Scoped to exactly one branch per environment. `main` cannot assume the
# development role and `develop` cannot assume the production role, so the
# branch→environment mapping is enforced by AWS's trust policy rather than by
# the workflow file — a workflow edit alone cannot ship develop to production.

module "github_oidc" {
  source = "../github-oidc"

  name                 = local.name
  github_repository    = var.github_repository
  github_org_id        = var.github_org_id
  github_repository_id = var.github_repository_id
  allowed_branches     = var.github_deploy_branches

  web_bucket_arn              = module.frontend.bucket_arn
  cloudfront_distribution_arn = module.frontend.distribution_arn
  ecr_repository_arns         = values(module.ecr.repository_arns)

  ecs_service_arns = [
    "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${local.name}/${local.name}-api",
  ]
}

# ---- CloudWatch --------------------------------------------------------------

module "observability" {
  source = "../observability"

  name               = local.name
  services           = ["api"]
  log_retention_days = var.log_retention_days
  alarm_email        = var.alarm_email
  alb_arn_suffix     = module.alb.alb_arn_suffix
  cluster_name       = local.name
  api_service_name   = "${local.name}-api"
}

# ---- ECS ---------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

module "api_service" {
  source = "../ecs-service"

  name                  = "${local.name}-api"
  region                = var.aws_region
  cluster_arn           = aws_ecs_cluster.this.arn
  vpc_id                = var.vpc_id
  private_subnet_ids    = var.private_subnet_ids
  alb_security_group_id = module.alb.alb_security_group_id
  create_security_group = false # plan-time literal; the SG above is created here
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
    NODE_ENV = "production" # the build mode, not the deployment tier
    # The deployment tier. Lets the API turn on debug affordances and feature
    # flags outside production without a second build artefact.
    APP_ENV                 = var.environment
    API_PORT                = "4000"
    API_PUBLIC_URL          = local.api_url
    WEB_PUBLIC_URL          = local.web_url
    CORS_ORIGINS            = local.cors_origins
    REDIS_URL               = module.redis.redis_url
    LOG_LEVEL               = var.log_level
    OPENAI_REALTIME_MODEL   = var.openai_realtime_model
    OPENAI_RESPONSES_MODEL  = var.openai_responses_model
    OPENAI_EMBEDDING_MODEL  = var.openai_embedding_model
    TWILIO_MEDIA_STREAM_URL = "wss://${var.api_domain}/v1/telephony/media-stream"
    CLERK_PUBLISHABLE_KEY   = var.clerk_publishable_key
    VAPID_PUBLIC_KEY        = var.vapid_public_key
    VAPID_SUBJECT           = var.vapid_subject
    AWS_REGION              = var.aws_region
    S3_BUCKET_RECORDINGS    = module.s3.bucket_names["recordings"]
    S3_BUCKET_UPLOADS       = module.s3.bucket_names["uploads"]
    SQS_QUEUE_URL           = module.sqs.queue_url
    BACKGROUND_JOBS_INLINE  = "true"

    PAYMENTS_ENABLED = tostring(var.payments_enabled)
    PAYMENT_PROVIDER = var.payment_provider

    PADDLE_ENVIRONMENT                = var.paddle_environment
    PADDLE_PRICE_STARTER_MONTHLY      = var.paddle_price_starter_monthly
    PADDLE_PRICE_PROFESSIONAL_MONTHLY = var.paddle_price_professional_monthly
    PADDLE_PRICE_STARTER_ANNUAL       = var.paddle_price_starter_annual
    PADDLE_PRICE_PROFESSIONAL_ANNUAL  = var.paddle_price_professional_annual
    STRIPE_PRICE_STARTER              = var.stripe_price_starter
    STRIPE_PRICE_PROFESSIONAL         = var.stripe_price_professional
    BILLING_TRIAL_PERIOD_DAYS         = tostring(var.billing_trial_period_days)
    BILLING_GRANDFATHER_BEFORE        = var.billing_grandfather_before
  }

  secrets = merge(
    {
      DATABASE_URL       = "${module.secrets.database_secret_arn}:DATABASE_URL::"
      CLERK_SECRET_KEY   = "${module.secrets.app_secret_arn}:CLERK_SECRET_KEY::"
      OPENAI_API_KEY     = "${module.secrets.app_secret_arn}:OPENAI_API_KEY::"
      TWILIO_ACCOUNT_SID = "${module.secrets.app_secret_arn}:TWILIO_ACCOUNT_SID::"
      TWILIO_AUTH_TOKEN  = "${module.secrets.app_secret_arn}:TWILIO_AUTH_TOKEN::"
    },
    var.payments_enabled && var.payment_provider == "paddle"
    ? {
      PADDLE_API_KEY        = "${module.secrets.app_secret_arn}:PADDLE_API_KEY::"
      PADDLE_WEBHOOK_SECRET = "${module.secrets.app_secret_arn}:PADDLE_WEBHOOK_SECRET::"
      PADDLE_CLIENT_TOKEN   = "${module.secrets.app_secret_arn}:PADDLE_CLIENT_TOKEN::"
    }
    : {},
    var.payments_enabled && var.payment_provider == "stripe"
    ? {
      STRIPE_SECRET_KEY     = "${module.secrets.app_secret_arn}:STRIPE_SECRET_KEY::"
      STRIPE_WEBHOOK_SECRET = "${module.secrets.app_secret_arn}:STRIPE_WEBHOOK_SECRET::"
    }
    : {},
    var.clerk_webhook_secret != ""
    ? { CLERK_WEBHOOK_SECRET = "${module.secrets.app_secret_arn}:CLERK_WEBHOOK_SECRET::" }
    : {},
    var.vapid_private_key != ""
    ? { VAPID_PRIVATE_KEY = "${module.secrets.app_secret_arn}:VAPID_PRIVATE_KEY::" }
    : {},
  )
}
