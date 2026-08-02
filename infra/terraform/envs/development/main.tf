# =============================================================================
# RoofersLabs — development environment
# =============================================================================
#   https://dev.rooferslabs.com       the SPA      (own S3 bucket + CloudFront)
#   https://api.dev.rooferslabs.com   the API      (own ECS service + database)
#
# Isolation, and what it costs
# ----------------------------
# Everything that holds, routes, or authorizes data is this environment's own:
# database, cache, secrets, buckets, queue, ECS cluster + service + task
# definition, target group, CDN, CI deploy role. Production cannot reach any of
# it and it cannot reach production's.
#
# Two things are shared, both of them idle capacity that carries no state: the
# VPC (with its NAT gateway) and the application load balancer. Development gets
# its own hostname on that load balancer via a host-header rule and its own SNI
# certificate — see modules/alb-host. That is roughly $50/month not spent on a
# second NAT gateway and a second idle ALB.
#
# The shared pieces are discovered by name rather than read out of production's
# state file, so the two roots stay independent: this one can be planned,
# applied, and destroyed without production's state being present at all.
#
# See docs/environments.md for the deployment runbook and the Cloudflare records.

data "aws_caller_identity" "current" {}

locals {
  name = "rooferslabs-${var.environment}"

  # The whole environment lives under one label, so a glance at any hostname
  # says which environment answered it.
  environment_domain = "${var.environment_subdomain}.${var.root_domain}"
  api_domain         = "${var.api_subdomain}.${local.environment_domain}"
  web_url            = "https://${local.environment_domain}"
  api_url            = "https://${local.api_domain}"

  # Development's SPA is the only browser origin it serves. localhost is allowed
  # as well so a frontend running on a laptop can be pointed at the deployed
  # development API — the reason to have a deployed development API at all.
  cors_origins = join(",", concat([local.web_url], var.local_cors_origins))
}

# ---- Shared infrastructure (owned by envs/production) ------------------------
#
# Looked up, never managed. Nothing in this root can modify the VPC or the load
# balancer; it only adds a target group inside the one and a rule on the other.

data "aws_lb" "shared" {
  name = var.shared_stack_name
}

data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.shared.arn
  port              = 443
}

data "aws_security_group" "shared_alb" {
  vpc_id = data.aws_lb.shared.vpc_id

  filter {
    name   = "group-name"
    values = ["${var.shared_stack_name}-alb"]
  }
}

# The private subnets the shared VPC already has. Development's tasks, database
# and cache go in these — they reach the internet through the NAT gateway that
# is running either way.
data "aws_subnets" "shared_private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_lb.shared.vpc_id]
  }

  filter {
    name   = "tag:Name"
    values = ["${var.shared_stack_name}-private-*"]
  }
}

# ---- Guardrails --------------------------------------------------------------
#
# Three ways this root could quietly become a second production, each failed at
# plan time rather than discovered from a customer's bank statement.

locals {
  billing_credentials_present = (
    var.payment_provider == "paypal"
    ? (
      var.paypal_client_id != "" &&
      var.paypal_client_secret != ""
    )
    : (
      var.stripe_secret_key != "" &&
      var.stripe_webhook_secret != "" &&
      var.stripe_price_starter != "" &&
      var.stripe_price_professional != ""
    )
  )

  uses_live_clerk_key = (
    startswith(var.clerk_publishable_key, "pk_live_") ||
    startswith(var.clerk_secret_key, "sk_live_")
  )
}

resource "terraform_data" "environment_guards" {
  input = "${var.environment}-${var.paypal_environment}-${var.payments_enabled}"

  lifecycle {
    # Development bills through PayPal's SANDBOX unless someone deliberately
    # says otherwise. A checkout opened against the live estate takes real money
    # from whoever is testing, so the switch is two values rather than one: the
    # estate, and an explicit acknowledgement of what it means. Same shape as the
    # live-Clerk-key guard below.
    precondition {
      condition     = var.paypal_environment == "sandbox" || var.allow_live_paypal
      error_message = "paypal_environment = \"live\" in development also requires allow_live_paypal = true — live PayPal credentials here charge real cards."
    }

    # A live Clerk key would put development sessions on production identities:
    # the same users, the same organizations, the same tokens.
    precondition {
      condition     = !local.uses_live_clerk_key || var.allow_live_clerk_key
      error_message = "clerk_publishable_key/clerk_secret_key look like production (pk_live_/sk_live_). Development must use the Clerk development instance."
    }

    # Same rule production applies: never boot an API that enforces a payment
    # wall it has no credentials to enforce.
    precondition {
      condition = !var.payments_enabled || local.billing_credentials_present
      error_message = join(" ", [
        "payments_enabled = true requires the active provider's credentials:",
        "paypal_client_id and paypal_client_secret for PayPal — the product, plans and",
        "webhook are provisioned by `npm run billing:paypal:setup`, not configured here;",
        "stripe_secret_key, stripe_webhook_secret, stripe_price_starter and",
        "stripe_price_professional for Stripe. Set payments_enabled = false to run without billing.",
      ])
    }

    # Two subnets in two AZs are what RDS and ElastiCache subnet groups require.
    # A wrong shared_stack_name shows up here rather than as an apply-time error
    # three resources later.
    precondition {
      condition     = length(data.aws_subnets.shared_private.ids) >= 2
      error_message = "Found fewer than two private subnets tagged ${var.shared_stack_name}-private-* in the shared VPC. Check shared_stack_name and aws_region."
    }
  }
}

# ---- API service security group ----------------------------------------------
# Development's own security group in the shared VPC. Production's database and
# cache do not whitelist it, and this one is not whitelisted by them — the two
# environments are neighbours on a network neither can cross.

resource "aws_security_group" "api_service" {
  name        = "${local.name}-api-svc"
  description = "Ingress from the shared ALB to the development API service"
  vpc_id      = data.aws_lb.shared.vpc_id

  ingress {
    description     = "API port from the shared ALB"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [data.aws_security_group.shared_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-api-svc" }
}

# ---- Hostname on the shared load balancer ------------------------------------

module "alb_host" {
  source = "../../modules/alb-host"

  name          = "${local.name}-api"
  host          = local.api_domain
  vpc_id        = data.aws_lb.shared.vpc_id
  listener_arn  = data.aws_lb_listener.https.arn
  rule_priority = var.alb_rule_priority
  enable_https  = var.enable_https
}

# ---- Container registry ------------------------------------------------------
# Its own repository, not a tag convention inside production's. A development
# push can then never be the image production pulls on its next restart.

module "ecr" {
  source = "../../modules/ecr"

  name         = local.name
  repositories = ["api"]
}

# ---- Data stores -------------------------------------------------------------

module "rds" {
  source = "../../modules/rds"

  name                       = local.name
  vpc_id                     = data.aws_lb.shared.vpc_id
  private_subnet_ids         = data.aws_subnets.shared_private.ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  instance_class             = var.db_instance_class
  multi_az                   = false
  deletion_protection        = var.db_deletion_protection
  backup_retention_days      = var.db_backup_retention_days
}

module "redis" {
  source = "../../modules/redis"

  name                       = local.name
  vpc_id                     = data.aws_lb.shared.vpc_id
  private_subnet_ids         = data.aws_subnets.shared_private.ids
  allowed_security_group_ids = [aws_security_group.api_service.id]
  node_type                  = var.redis_node_type
}

module "s3" {
  source = "../../modules/s3"

  name = "${local.name}-${data.aws_caller_identity.current.account_id}"
  # Development recordings and uploads are disposable; let a teardown take them.
  force_destroy = true
}

module "sqs" {
  source = "../../modules/sqs"

  name = local.name
}

# ---- Frontend (S3 + CloudFront + OAC) ----------------------------------------
# `root_domain` is this environment's own hostname, not the apex: it is what the
# certificate is issued for and what the generated CSP is built around.

module "frontend" {
  source = "../../modules/frontend-cdn"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name        = local.name
  bucket_name = "${local.name}-web-${data.aws_caller_identity.current.account_id}"

  domain_aliases      = [local.environment_domain]
  certificate_domains = [local.environment_domain]
  root_domain         = local.environment_domain
  api_domain          = local.api_domain

  # No admin portal in development: the portal is a production surface, and an
  # edge redirect for a hostname nobody will create is dead configuration.
  admin_host = ""

  enable_custom_domain    = var.enable_web_custom_domain
  price_class             = var.web_price_class
  content_security_policy = var.web_content_security_policy
  log_retention_days      = var.log_retention_days
}

# ---- Secrets -----------------------------------------------------------------
# Separate Secrets Manager entries under this environment's own prefix. The
# production execution role is scoped to production's ARNs and cannot read these.

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
    # Credentials are supplied whenever they EXIST, not only when the payment
    # wall is up.
    #
    # Provisioning has to happen before billing can be enabled — `billing.sh`
    # runs as a one-off task on this task definition and needs the credentials
    # to reach PayPal — so gating them on payments_enabled created a deadlock:
    # you could not provision until the wall was up, and the API refuses to boot
    # with the wall up and nothing provisioned. Presence is the right condition;
    # an unused credential in the task definition costs nothing.
    var.payment_provider == "paypal" && var.paypal_client_id != "" ? {
      PAYPAL_CLIENT_ID     = var.paypal_client_id
      PAYPAL_CLIENT_SECRET = var.paypal_client_secret
    } : {},
    var.payments_enabled && var.payment_provider == "stripe" ? {
      STRIPE_SECRET_KEY     = var.stripe_secret_key
      STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
    } : {},
    var.clerk_webhook_secret != "" ? { CLERK_WEBHOOK_SECRET = var.clerk_webhook_secret } : {},
    var.vapid_private_key != "" ? { VAPID_PRIVATE_KEY = var.vapid_private_key } : {},
  )

  # Development secrets are rebuilt from tfvars, so a teardown should not leave
  # names locked for a week against the next apply.
  recovery_window_in_days = 0
}

# ---- IAM ---------------------------------------------------------------------

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

# ---- CI deploy role (GitHub Actions OIDC) ------------------------------------
# Trusts `develop` and nothing else, and is scoped to development's bucket,
# distribution, registry and service. This is the layer that makes the branch
# split real: a workflow run on main cannot assume this role at all, so it could
# not deploy to development even if its configuration told it to.

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                 = local.name
  github_repository    = var.github_repository
  github_org_id        = var.github_org_id
  github_repository_id = var.github_repository_id
  allowed_branches     = var.github_deploy_branches

  # Account-wide singleton, already created by the production stack.
  create_oidc_provider = false

  web_bucket_arn              = module.frontend.bucket_arn
  cloudfront_distribution_arn = module.frontend.distribution_arn
  ecr_repository_arns         = values(module.ecr.repository_arns)

  ecs_service_arns = [
    "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:service/${local.name}/${local.name}-api",
  ]
}

# ---- CloudWatch --------------------------------------------------------------

module "observability" {
  source = "../../modules/observability"

  name               = local.name
  services           = ["api"]
  log_retention_days = var.log_retention_days
  alarm_email        = var.alarm_email
  cluster_name       = local.name
  api_service_name   = "${local.name}-api"

  # The load balancer is shared, so its 5xx metric counts production's traffic
  # too. Scoping the alarm to this environment's target group is what keeps a
  # development alarm from firing on a production incident, and vice versa.
  alb_arn_suffix          = data.aws_lb.shared.arn_suffix
  target_group_arn_suffix = module.alb_host.target_group_arn_suffix
}

# ---- ECS ---------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled" # development pays for logs, not for per-task metrics
  }
}

module "api_service" {
  source = "../../modules/ecs-service"

  name                  = "${local.name}-api"
  region                = var.aws_region
  cluster_arn           = aws_ecs_cluster.this.arn
  vpc_id                = data.aws_lb.shared.vpc_id
  private_subnet_ids    = data.aws_subnets.shared_private.ids
  alb_security_group_id = data.aws_security_group.shared_alb.id
  create_security_group = false # plan-time literal; the SG above is created in this root
  security_group_id     = aws_security_group.api_service.id
  target_group_arn      = module.alb_host.target_group_arn

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
    # are separate because the API has to know it is a *deployed* environment
    # (so its configuration is validated in full) while still running with
    # development-grade diagnostics. See apps/api/src/config/environment-guard.ts.
    NODE_ENV                = "development"
    APP_ENV                 = "development"
    API_PORT                = "4000"
    API_PUBLIC_URL          = local.api_url
    WEB_PUBLIC_URL          = local.web_url
    CORS_ORIGINS            = local.cors_origins
    REDIS_URL               = module.redis.redis_url
    LOG_LEVEL               = "debug"
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
    SQS_QUEUE_URL           = module.sqs.queue_url
    BACKGROUND_JOBS_INLINE  = "true"

    PAYMENTS_ENABLED = tostring(var.payments_enabled)
    PAYMENT_PROVIDER = var.payment_provider

    PAYPAL_ENVIRONMENT = var.paypal_environment
    # Optional override. Normally empty: `billing:paypal:setup` registers the
    # webhook and persists its id, so nothing has to be pasted here.
    PAYPAL_WEBHOOK_ID = var.paypal_webhook_id
    # Temporary: charges the $1.00 test plan instead of the published $49.00
    # one. See variables.tf. The API logs at error level while this is true.
    PAYPAL_TEST_PRICING        = tostring(var.paypal_test_pricing)
    STRIPE_PRICE_STARTER       = var.stripe_price_starter
    STRIPE_PRICE_PROFESSIONAL  = var.stripe_price_professional
    BILLING_TRIAL_PERIOD_DAYS  = tostring(var.billing_trial_period_days)
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
    # Kept in lockstep with app_secrets above: wired whenever the credentials
    # exist, so a one-off provisioning task can authenticate before the wall is
    # ever switched on.
    var.payment_provider == "paypal" && var.paypal_client_id != ""
    ? {
      PAYPAL_CLIENT_ID     = "${module.secrets.app_secret_arn}:PAYPAL_CLIENT_ID::"
      PAYPAL_CLIENT_SECRET = "${module.secrets.app_secret_arn}:PAYPAL_CLIENT_SECRET::"
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
