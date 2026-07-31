# =============================================================================
# RoofersLabs — production environment
# =============================================================================
# Composes the reusable modules into the backend stack:
#   VPC → ALB (+ACM) → ECR → RDS → Redis → S3 → SQS → Secrets → IAM
#   → CloudWatch → ECS Fargate (api)
#
# The frontend (apps/web) is a static Vite SPA served from S3 + CloudFront
# (module "frontend" below). This stack owns the full production footprint:
# frontend CDN + backend API.
#
# See infra/terraform/README.md for the from-scratch walkthrough.

data "aws_caller_identity" "current" {}

locals {
  name = "rooferslabs-${var.environment}"

  # The hostnames the platform is built around:
  #   <root>        the customer application (this SPA)
  #   app.<root>    the same SPA under an application-shaped name
  #   admin.<root>  the internal admin portal — not built yet, see below
  #   api.<root>    the backend all of them call
  api_domain   = "${var.api_subdomain}.${var.root_domain}"
  app_domain   = "${var.app_subdomain}.${var.root_domain}"
  admin_domain = "${var.admin_subdomain}.${var.root_domain}"
  api_url      = "https://${local.api_domain}"
  app_url      = "https://${local.app_domain}"
  admin_url    = "https://${local.admin_domain}"
  root_url     = "https://${var.root_domain}"

  # WEB_PUBLIC_URL is the canonical public origin of the customer app: the apex,
  # which is what sign-in redirects and emailed links resolve to. `app.<domain>`
  # is an additional alias on the same distribution serving the same build, so
  # it is a CORS origin but never the canonical one.
  #
  # `admin.<domain>` is allowed ahead of the portal existing so the API needs no
  # infrastructure change on the day it ships. Allowing an origin that nobody
  # can serve costs nothing — reaching it would require control of the DNS zone.
  # Applies to the API only; Cloudflare DNS and the CloudFront aliases are
  # configured out-of-band.
  web_public_url = local.root_url
  cors_origins = join(",", [
    local.root_url,
    "https://www.${var.root_domain}",
    local.app_url,
    local.admin_url,
  ])
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

# ---- Frontend (S3 + CloudFront + OAC) ---------------------------------------
# The Vite SPA is uploaded by infra/scripts/deploy-web.sh; this owns the CDN.

module "frontend" {
  source = "../../modules/frontend-cdn"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name        = local.name
  bucket_name = "${local.name}-web-${data.aws_caller_identity.current.account_id}"

  # The SPA is served from the apex + www, and — once enabled — the app and
  # admin hosts. One distribution, one bucket, one build: every one of these is
  # a route inside this SPA, so a second distribution would serve identical
  # bytes at twice the cost and half the certainty they match.
  domain_aliases = concat(
    [var.root_domain, "www.${var.root_domain}"],
    var.enable_app_alias ? [local.app_domain] : [],
    var.enable_admin_alias ? [local.admin_domain] : [],
  )

  # Requested a stage earlier than the alias is attached, so the certificate can
  # validate while the live site keeps serving on the one it already has.
  certificate_domains = concat(
    [var.root_domain, "www.${var.root_domain}"],
    var.request_app_certificate ? [local.app_domain] : [],
    var.request_admin_certificate ? [local.admin_domain] : [],
  )

  # Only meaningful once the alias is live; harmless before then.
  admin_host              = var.enable_admin_alias ? local.admin_domain : ""
  root_domain             = var.root_domain
  api_domain              = local.api_domain
  enable_custom_domain    = var.enable_web_custom_domain
  price_class             = var.web_price_class
  content_security_policy = var.web_content_security_policy
}

module "sqs" {
  source = "../../modules/sqs"

  name = local.name
}

# ---- Secrets -----------------------------------------------------------------------

# Turning the payment wall on without the credentials to enforce it would boot an
# API that rejects every customer, so fail the plan instead of the deployment.
#
# Only the *selected* provider's credentials are demanded. That is what lets the
# stack run with no Stripe account at all while Paddle is active, and would let
# it run with no Paddle account if the two were ever swapped back.
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

module "secrets" {
  source = "../../modules/secrets"

  name         = local.name
  database_url = module.rds.database_url

  # Billing keys are written only while payments are enabled, and only for the
  # provider actually in use. They are omitted rather than stored empty because
  # the task definition below reads individual JSON keys out of this secret — a
  # key that exists but is blank would start a task that then fails env
  # validation, which is harder to diagnose than a key that is simply not wired.
  app_secrets = merge(
    {
      CLERK_SECRET_KEY   = var.clerk_secret_key
      OPENAI_API_KEY     = var.openai_api_key
      TWILIO_ACCOUNT_SID = var.twilio_account_sid
      TWILIO_AUTH_TOKEN  = var.twilio_auth_token
    },
    # Billing gates every tenant's access, so with payments on the API refuses
    # to boot without these. The dormant provider's keys are never stored — the
    # platform holds no credentials for a processor it is not using.
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

# ---- CI deploy role (GitHub Actions OIDC) --------------------------------------------
# Scoped to this repo's main/develop branches and to exactly the resources the
# two deploy workflows touch: the SPA bucket, its distribution, the api ECR
# repository, and the api ECS service.

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                 = local.name
  github_repository    = var.github_repository
  github_org_id        = var.github_org_id
  github_repository_id = var.github_repository_id
  allowed_branches     = var.github_deploy_branches

  web_bucket_arn              = module.frontend.bucket_arn
  cloudfront_distribution_arn = module.frontend.distribution_arn
  ecr_repository_arns         = values(module.ecr.repository_arns)

  # Built here rather than taken from the module: aws_ecs_service exposes the
  # ARN as `id`, which reads as an accident at the call site.
  ecs_service_arns = [
    "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${local.name}/${local.name}-api",
  ]
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
    # NODE_ENV is the Node runtime mode; APP_ENV is the deployment tier. They
    # coincide here and diverge in development (NODE_ENV=development,
    # APP_ENV=development), which is why the API reads the tier from APP_ENV and
    # not from NODE_ENV. See apps/api/src/config/environment-guard.ts.
    NODE_ENV                = "production"
    APP_ENV                 = "production"
    API_PORT                = "4000"
    API_PUBLIC_URL          = local.api_url
    WEB_PUBLIC_URL          = local.web_public_url
    CORS_ORIGINS            = local.cors_origins
    REDIS_URL               = module.redis.redis_url
    LOG_LEVEL               = "info"
    OPENAI_REALTIME_MODEL   = var.openai_realtime_model
    OPENAI_REALTIME_VOICE   = var.openai_realtime_voice
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
    # Master switch for billing. False boots the API with no provider at all.
    PAYMENTS_ENABLED = tostring(var.payments_enabled)
    # Which processor is active. The other stays compiled but never constructed.
    PAYMENT_PROVIDER = var.payment_provider
    # Price IDs are configuration, not credentials — they identify what is for
    # sale and grant nothing, so they live in plain environment.
    PADDLE_ENVIRONMENT                = var.paddle_environment
    PADDLE_PRICE_STARTER_MONTHLY      = var.paddle_price_starter_monthly
    PADDLE_PRICE_PROFESSIONAL_MONTHLY = var.paddle_price_professional_monthly
    # Empty until annual plans launch; the API refuses a checkout for an
    # interval with no configured price rather than inventing one.
    PADDLE_PRICE_STARTER_ANNUAL      = var.paddle_price_starter_annual
    PADDLE_PRICE_PROFESSIONAL_ANNUAL = var.paddle_price_professional_annual
    STRIPE_PRICE_STARTER             = var.stripe_price_starter
    STRIPE_PRICE_PROFESSIONAL        = var.stripe_price_professional
    BILLING_TRIAL_PERIOD_DAYS        = tostring(var.billing_trial_period_days)
    # Tenants that predate the payment wall keep access without paying.
    BILLING_GRANDFATHER_BEFORE = var.billing_grandfather_before
  }

  secrets = merge(
    {
      DATABASE_URL       = "${module.secrets.database_secret_arn}:DATABASE_URL::"
      CLERK_SECRET_KEY   = "${module.secrets.app_secret_arn}:CLERK_SECRET_KEY::"
      OPENAI_API_KEY     = "${module.secrets.app_secret_arn}:OPENAI_API_KEY::"
      TWILIO_ACCOUNT_SID = "${module.secrets.app_secret_arn}:TWILIO_ACCOUNT_SID::"
      TWILIO_AUTH_TOKEN  = "${module.secrets.app_secret_arn}:TWILIO_AUTH_TOKEN::"

    },
    # Kept in lockstep with app_secrets above: wired only when payments are on,
    # and only for the provider actually in use.
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

