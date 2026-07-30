# =============================================================================
# RoofersLabs — PRODUCTION
# =============================================================================
# Live customer traffic. Deployed only from `main`.
#
#   https://rooferslabs.com
#   https://www.rooferslabs.com
#   https://api.rooferslabs.com
#
# This root owns the VPC (modules/networking) and composes one environment out
# of modules/platform. The development environment calls the same platform
# module with different arguments — see envs/development. Anything that should
# be true of both environments belongs in the module, not here.
#
# State is per-environment (see providers.tf). A development apply cannot read
# or write this state, and therefore cannot plan a change against any resource
# below.
#
# See infra/terraform/README.md for the from-scratch walkthrough and
# docs/environments.md for the two-environment architecture.

locals {
  api_domain   = "${var.api_subdomain}.${var.root_domain}"
  admin_domain = "${var.admin_subdomain}.${var.root_domain}"
}

# ---- Networking ---------------------------------------------------------------
# Production creates and owns the VPC. Development attaches to it read-only and
# adds its own subnets, so this stays the single owner of the address space.

module "networking" {
  source = "../../modules/networking"

  name = "rooferslabs-${var.environment}"
}

# ---- The environment ----------------------------------------------------------

module "platform" {
  source = "../../modules/platform"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = var.environment
  aws_region  = var.aws_region

  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids

  # Domains
  root_domain        = var.root_domain
  web_domain         = var.root_domain
  web_domain_aliases = ["www.${var.root_domain}"]
  api_domain         = local.api_domain
  admin_domain       = local.admin_domain
  enable_https       = var.enable_https

  # Frontend
  web_bucket_name             = "rooferslabs-${var.environment}-web-${data.aws_caller_identity.current.account_id}"
  enable_web_custom_domain    = var.enable_web_custom_domain
  request_admin_certificate   = var.request_admin_certificate
  enable_admin_alias          = var.enable_admin_alias
  web_price_class             = var.web_price_class
  web_content_security_policy = var.web_content_security_policy

  # Historical value: production's repository is rooferslabs/api and renaming it
  # would replace it, orphaning every image the running service can roll back to.
  ecr_namespace = "rooferslabs"

  # Credentials
  clerk_secret_key      = var.clerk_secret_key
  clerk_publishable_key = var.clerk_publishable_key
  clerk_webhook_secret  = var.clerk_webhook_secret
  openai_api_key        = var.openai_api_key
  twilio_account_sid    = var.twilio_account_sid
  twilio_auth_token     = var.twilio_auth_token

  # Billing
  payments_enabled                  = var.payments_enabled
  payment_provider                  = var.payment_provider
  paddle_environment                = var.paddle_environment
  paddle_api_key                    = var.paddle_api_key
  paddle_client_token               = var.paddle_client_token
  paddle_webhook_secret             = var.paddle_webhook_secret
  paddle_price_starter_monthly      = var.paddle_price_starter_monthly
  paddle_price_professional_monthly = var.paddle_price_professional_monthly
  paddle_price_starter_annual       = var.paddle_price_starter_annual
  paddle_price_professional_annual  = var.paddle_price_professional_annual
  stripe_secret_key                 = var.stripe_secret_key
  stripe_webhook_secret             = var.stripe_webhook_secret
  stripe_price_starter              = var.stripe_price_starter
  stripe_price_professional         = var.stripe_price_professional
  billing_trial_period_days         = var.billing_trial_period_days
  billing_grandfather_before        = var.billing_grandfather_before

  # Known, temporary deviations from the production guardrails. Both are
  # tracked in docs/environments.md; clearing them is the launch checklist.
  allow_clerk_instance_mismatch     = var.allow_clerk_instance_mismatch
  allow_paddle_environment_mismatch = var.allow_paddle_environment_mismatch

  # Web Push
  vapid_public_key  = var.vapid_public_key
  vapid_private_key = var.vapid_private_key
  vapid_subject     = var.vapid_subject

  # Sizing — production defaults
  api_cpu                = var.api_cpu
  api_memory             = var.api_memory
  api_desired_count      = var.api_desired_count
  db_instance_class      = var.db_instance_class
  db_multi_az            = var.db_multi_az
  db_deletion_protection = var.db_deletion_protection
  redis_node_type        = var.redis_node_type
  log_level              = "info"
  log_retention_days     = var.log_retention_days
  alarm_email            = var.alarm_email
  openai_realtime_model  = var.openai_realtime_model
  openai_responses_model = var.openai_responses_model
  openai_embedding_model = var.openai_embedding_model

  # Only `main` may deploy production. This is the AWS-side half of the
  # branch→environment mapping; the workflow's half is in .github/workflows.
  github_repository      = var.github_repository
  github_deploy_branches = ["main"]
  github_org_id          = var.github_org_id
  github_repository_id   = var.github_repository_id
}

data "aws_caller_identity" "current" {}

# ---- State moves for the platform-module refactor ----------------------------
# Composing production out of modules/platform changed these resources' state
# addresses but not the resources themselves. Without these blocks Terraform
# would read the new addresses as new resources and propose destroying and
# recreating the entire production environment — the database included.
#
# `moved` for a module block carries every resource inside it, so one entry per
# module is enough. Verify with: terraform plan → "0 to add, 0 to change,
# 0 to destroy". Anything else means a move is missing; do not apply.
#
# These can be deleted once a plan has confirmed the moves in every workspace
# that tracks this environment.

moved {
  from = module.ecr
  to   = module.platform.module.ecr
}

moved {
  from = module.alb
  to   = module.platform.module.alb
}

moved {
  from = aws_security_group.api_service
  to   = module.platform.aws_security_group.api_service
}

moved {
  from = module.rds
  to   = module.platform.module.rds
}

moved {
  from = module.redis
  to   = module.platform.module.redis
}

moved {
  from = module.s3
  to   = module.platform.module.s3
}

moved {
  from = module.frontend
  to   = module.platform.module.frontend
}

moved {
  from = module.sqs
  to   = module.platform.module.sqs
}

moved {
  from = terraform_data.payments_config_check
  to   = module.platform.terraform_data.payments_config_check
}

moved {
  from = module.secrets
  to   = module.platform.module.secrets
}

moved {
  from = module.iam
  to   = module.platform.module.iam
}

moved {
  from = module.github_oidc
  to   = module.platform.module.github_oidc
}

moved {
  from = module.observability
  to   = module.platform.module.observability
}

moved {
  from = aws_ecs_cluster.this
  to   = module.platform.aws_ecs_cluster.this
}

moved {
  from = module.api_service
  to   = module.platform.module.api_service
}
