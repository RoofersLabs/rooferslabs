# =============================================================================
# RoofersLabs — DEVELOPMENT
# =============================================================================
# Backing services for LOCAL development. There is no deployed development
# website and no development compute:
#
#   no ECS      no ALB      no CloudFront      no S3 site      no NAT gateway
#
# The application runs on localhost — `npm run dev:api` and `npm run dev:web` —
# and reaches this environment's database over the public internet, restricted
# to the operator's own address. Everything else a developer needs (Redis) runs
# in Docker, because ElastiCache has no public endpoint and never will, and a
# bastion to reach a cache holding nothing durable is not worth running.
#
# What this environment deliberately IS:
#   - its own VPC, sharing nothing with production
#   - its own RDS instance, credentials, backups, snapshots, migration history
#   - its own Secrets Manager entries, readable by a policy production never uses
#
# Cost: one db.t4g.micro and its storage. The VPC is free — no NAT gateway is
# provisioned, because nothing in here needs outbound internet.
#
# Adding devstage.rooferslabs.com later does not disturb any of this: it is a
# third root calling modules/platform, exactly as envs/production does. Nothing
# here has to change for that to happen — see docs/environments.md.

locals {
  name = "rooferslabs-${var.environment}"
}

data "aws_caller_identity" "current" {}

# ---- Networking ---------------------------------------------------------------
# A separate VPC rather than a corner of production's. With no NAT gateway the
# isolation is free, so there is no cost argument for sharing an address space
# with live customer data.

module "networking" {
  source = "../../modules/networking"

  name     = local.name
  vpc_cidr = var.vpc_cidr

  # Nothing in this environment runs in a private subnet or needs egress.
  enable_nat_gateway = false
}

# ---- Database -----------------------------------------------------------------
# Public endpoint, locked to the operator's address, TLS enforced server-side.
#
# The alternative — private RDS plus an SSM bastion — means an EC2 instance to
# patch and a tunnel to establish before any local work can start. For a
# single-operator development database holding no customer data, a /32 allowlist
# and forced TLS is the better trade: strictly less to run, and the exposure is
# one address rather than one instance.
#
# It sits in the public subnets because a public endpoint requires a route to an
# internet gateway.

module "rds" {
  source = "../../modules/rds"

  name               = local.name
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.public_subnet_ids

  # No in-VPC compute exists to name as a source. The allowlist is the boundary.
  allowed_security_group_ids = []
  allowed_cidr_blocks        = var.developer_cidr_blocks
  publicly_accessible        = true

  instance_class = var.db_instance_class

  # Development-appropriate, and deliberately different from production:
  # short backup retention, no deletion protection, and no final snapshot, so
  # this environment can be destroyed and rebuilt from migrations whenever it
  # gets into a state not worth untangling.
  backup_retention_days = var.db_backup_retention_days
  deletion_protection   = false
  multi_az              = false
  apply_immediately     = true
}

# ---- Secrets ------------------------------------------------------------------
# Namespaced rooferslabs-development/*, entirely separate entries from
# rooferslabs-production/*. Nothing reads both.
#
# Not used by local development, which runs Postgres and Redis in Docker and
# reads no AWS secret at all (docs/local-development.md). These exist for a
# future shared development database; nothing consumes them today.

module "secrets" {
  source = "../../modules/secrets"

  name         = local.name
  database_url = module.rds.database_url

  # Development credentials only. A production key appearing in this map is a
  # bug, and the API's boot guard will refuse to start on one.
  app_secrets = merge(
    {
      CLERK_SECRET_KEY      = var.clerk_secret_key
      CLERK_PUBLISHABLE_KEY = var.clerk_publishable_key
      OPENAI_API_KEY        = var.openai_api_key
    },
    # Twilio and Paddle are optional here. Absent is the safe default: the API
    # runs locally without telephony or billing rather than falling back to
    # whatever credentials happen to be lying around, which is how a local test
    # ends up placing a real call or opening a live checkout.
    var.twilio_account_sid != "" ? { TWILIO_ACCOUNT_SID = var.twilio_account_sid } : {},
    var.twilio_auth_token != "" ? { TWILIO_AUTH_TOKEN = var.twilio_auth_token } : {},
    var.paddle_api_key != "" ? { PADDLE_API_KEY = var.paddle_api_key } : {},
    var.paddle_client_token != "" ? { PADDLE_CLIENT_TOKEN = var.paddle_client_token } : {},
    var.paddle_webhook_secret != "" ? { PADDLE_WEBHOOK_SECRET = var.paddle_webhook_secret } : {},
  )

  # Rebuilt often enough that a 7-day recovery window mostly gets in the way of
  # re-creating the environment under the same name.
  recovery_window_in_days = 0
}

# ---- Guardrails ----------------------------------------------------------------
# The same checks modules/platform applies, enforced here too so the development
# root cannot be pointed at production credentials by a copy-paste. Terraform
# refuses the plan; the API's boot guard refuses the process. Two layers,
# because either one alone can be bypassed by someone in a hurry.

resource "terraform_data" "credential_isolation_check" {
  input = "${var.environment}-${substr(var.clerk_publishable_key, 0, 8)}"

  lifecycle {
    precondition {
      condition = (
        startswith(var.clerk_publishable_key, "pk_test_") &&
        startswith(var.clerk_secret_key, "sk_test_")
      )
      error_message = join(" ", [
        "Development requires Clerk DEVELOPMENT keys (pk_test_… / sk_test_…).",
        "A pk_live_/sk_live_ key here points local development at the live user",
        "directory, where test sign-ups become real customer records.",
      ])
    }
  }
}

resource "terraform_data" "paddle_isolation_check" {
  input = var.paddle_api_key != "" ? "configured" : "absent"

  lifecycle {
    precondition {
      # Paddle live API keys are pdl_live_…; sandbox keys are pdl_sdbx_….
      condition = var.paddle_api_key == "" || !startswith(var.paddle_api_key, "pdl_live_")
      error_message = join(" ", [
        "Development must use Paddle SANDBOX credentials (pdl_sdbx_…).",
        "A live key here lets local testing charge real payment methods.",
      ])
    }
  }
}

# ---- IAM ------------------------------------------------------------------------
# One managed policy granting read on THIS environment's secrets and nothing
# else. Attach it to whichever identity needs to read this environment.
#
# Written as its own policy rather than relying on broad administrator access so
# that the development path has a least-privilege option available the day a
# second developer or a CI job needs one — and so the grant is auditable.

data "aws_iam_policy_document" "read_dev_secrets" {
  statement {
    sid    = "ReadDevelopmentSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    # Scoped to this environment's two secrets. The production ARNs are not
    # reachable through this policy under any condition.
    resources = [
      module.secrets.database_secret_arn,
      module.secrets.app_secret_arn,
    ]
  }
}

resource "aws_iam_policy" "read_dev_secrets" {
  name        = "${local.name}-read-secrets"
  description = "Read the development environment's secrets. Grants nothing in production."
  policy      = data.aws_iam_policy_document.read_dev_secrets.json
}
