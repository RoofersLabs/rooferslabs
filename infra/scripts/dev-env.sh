#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — generate the local development environment files
# =============================================================================
# Pulls the DEVELOPMENT environment's configuration out of AWS Secrets Manager
# and writes the .env files the local API and web dev servers read.
#
#   infra/scripts/dev-env.sh            # write the env files
#   infra/scripts/dev-env.sh --print    # show what would be written, secrets masked
#   infra/scripts/dev-env.sh --check    # verify the current files, write nothing
#
# This exists so that local configuration is never hand-assembled. Copying keys
# out of a dashboard into a .env is how a production key ends up on a laptop —
# the values here can only come from the development environment, because that
# is the only place this script looks.
#
# What it writes:
#   .env                          API + Prisma (repo root; both read it)
#   apps/web/.env.local           Vite dev server
#
# Both are gitignored. Neither is ever read by a deployed environment: ECS gets
# its configuration from the task definition and Secrets Manager directly.
#
# Redis is NOT fetched. Development Redis runs in Docker on localhost — see
# docker/docker-compose.yml — because ElastiCache has no public endpoint and a
# bastion to reach a cache holding nothing durable is not worth running.
#
# Requires: aws CLI (authenticated), jq, terraform.
set -euo pipefail

MODE="${1:-write}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/development"

command -v jq >/dev/null || { echo "error: jq is required." >&2; exit 1; }
command -v aws >/dev/null || { echo "error: the aws CLI is required." >&2; exit 1; }

# ---- Resolve the development environment ------------------------------------
# Read from Terraform outputs rather than hardcoded ARNs, so this keeps working
# if the environment is destroyed and rebuilt.

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || true; }

APP_SECRET_ARN="${DEV_APP_SECRET_ARN:-$(tf_out app_secret_arn)}"
DB_SECRET_ARN="${DEV_DB_SECRET_ARN:-$(tf_out database_secret_arn)}"
AWS_REGION="${AWS_REGION:-$(tf_out aws_region)}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ -z "$APP_SECRET_ARN" ] || [ -z "$DB_SECRET_ARN" ]; then
  cat >&2 <<'EOF'
error: could not resolve the development environment's secret ARNs.

The development environment may not be applied yet:

    cd infra/terraform/envs/development
    terraform init && terraform apply

Or set DEV_APP_SECRET_ARN and DEV_DB_SECRET_ARN directly.
EOF
  exit 1
fi

echo "==> Reading development secrets from ${AWS_REGION}…"

fetch_secret() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text
}

APP_JSON="$(fetch_secret "$APP_SECRET_ARN")"
DB_JSON="$(fetch_secret "$DB_SECRET_ARN")"

get() { printf '%s' "$1" | jq -r --arg k "$2" '.[$k] // ""'; }

DATABASE_URL="$(get "$DB_JSON" DATABASE_URL)"
CLERK_SECRET_KEY="$(get "$APP_JSON" CLERK_SECRET_KEY)"
CLERK_PUBLISHABLE_KEY="$(get "$APP_JSON" CLERK_PUBLISHABLE_KEY)"
OPENAI_API_KEY="$(get "$APP_JSON" OPENAI_API_KEY)"
TWILIO_ACCOUNT_SID="$(get "$APP_JSON" TWILIO_ACCOUNT_SID)"
TWILIO_AUTH_TOKEN="$(get "$APP_JSON" TWILIO_AUTH_TOKEN)"
PADDLE_API_KEY="$(get "$APP_JSON" PADDLE_API_KEY)"
PADDLE_CLIENT_TOKEN="$(get "$APP_JSON" PADDLE_CLIENT_TOKEN)"
PADDLE_WEBHOOK_SECRET="$(get "$APP_JSON" PADDLE_WEBHOOK_SECRET)"

# ---- Refuse to write production credentials ---------------------------------
# The same rule the API enforces at boot, applied before anything reaches disk.
# A production value here means the wrong secret ARN was resolved, and the right
# response is to stop rather than to write it and warn.

fail_if_production() {
  local label="$1" value="$2" prefix="$3"
  case "$value" in
    "$prefix"*)
      echo "error: $label looks like a PRODUCTION credential (${prefix}…)." >&2
      echo "       Refusing to write production credentials to a local file." >&2
      echo "       Check that $TF_DIR is the development environment." >&2
      exit 1
      ;;
  esac
}

fail_if_production "CLERK_PUBLISHABLE_KEY" "$CLERK_PUBLISHABLE_KEY" "pk_live_"
fail_if_production "CLERK_SECRET_KEY" "$CLERK_SECRET_KEY" "sk_live_"
fail_if_production "PADDLE_API_KEY" "$PADDLE_API_KEY" "pdl_live_"

case "$DATABASE_URL" in
  *rooferslabs-production*)
    echo "error: DATABASE_URL points at the PRODUCTION database. Refusing to write it." >&2
    exit 1
    ;;
esac

# Billing is only switched on locally when sandbox credentials actually exist.
# Defaulting it on without them would boot an API whose billing endpoints all
# answer 503 for reasons that look like a bug.
if [ -n "$PADDLE_API_KEY" ] && [ -n "$PADDLE_CLIENT_TOKEN" ]; then
  PAYMENTS_ENABLED="true"
else
  PAYMENTS_ENABLED="false"
fi

API_ENV_FILE="$REPO_ROOT/.env"
WEB_ENV_FILE="$REPO_ROOT/apps/web/.env.local"

render_api_env() {
  cat <<EOF
# =============================================================================
# GENERATED by infra/scripts/dev-env.sh — do not edit.
# =============================================================================
# Re-run the script to refresh. Every value comes from the DEVELOPMENT
# environment's Secrets Manager entries; nothing here is production.
#
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# The deployment tier. Distinct from NODE_ENV, which selects a build mode.
# The API refuses to start if these credentials disagree with this value.
APP_ENV=development
NODE_ENV=development
LOG_LEVEL=debug

API_PORT=4000
API_PUBLIC_URL=http://localhost:4000
WEB_PUBLIC_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Development RDS. Reachable only from the addresses in the development
# environment's developer_cidr_blocks; TLS is enforced server-side.
DATABASE_URL=$DATABASE_URL

# Docker, not ElastiCache: docker compose -f docker/docker-compose.yml up -d redis
REDIS_URL=redis://localhost:6379

# Clerk DEVELOPMENT instance.
CLERK_SECRET_KEY=$CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY

OPENAI_API_KEY=$OPENAI_API_KEY

# Empty when no development Twilio subaccount exists — telephony stays disabled
# rather than falling back to production credentials.
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN

# Paddle SANDBOX. Settles no money.
PAYMENTS_ENABLED=$PAYMENTS_ENABLED
PAYMENT_PROVIDER=paddle
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=$PADDLE_API_KEY
PADDLE_CLIENT_TOKEN=$PADDLE_CLIENT_TOKEN
PADDLE_WEBHOOK_SECRET=$PADDLE_WEBHOOK_SECRET

BACKGROUND_JOBS_INLINE=true
EOF
}

render_web_env() {
  cat <<EOF
# =============================================================================
# GENERATED by infra/scripts/dev-env.sh — do not edit.
# =============================================================================
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Selects the development service-worker cache namespace and enables debug
# affordances in the SPA. Never "production" outside a production build.
VITE_APP_ENV=development

VITE_API_BASE_URL=http://localhost:4000
VITE_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
EOF
}

mask() { sed -E 's/(=(sk|pk|pdl|postgresql)[^ ]{6}).*/\1…MASKED/'; }

case "$MODE" in
  --print)
    echo "--- $API_ENV_FILE ---"; render_api_env | mask
    echo; echo "--- $WEB_ENV_FILE ---"; render_web_env | mask
    ;;

  --check)
    status=0
    for f in "$API_ENV_FILE" "$WEB_ENV_FILE"; do
      if [ ! -f "$f" ]; then
        echo "missing: $f"; status=1
      elif ! grep -q "GENERATED by infra/scripts/dev-env.sh" "$f"; then
        echo "hand-edited (not generated): $f"; status=1
      else
        echo "ok: $f"
      fi
    done
    # A production credential in a local file is the failure this whole split
    # exists to prevent, so check for it explicitly rather than trusting the
    # generator to have been the last thing that wrote here.
    if grep -qE 'pk_live_|sk_live_|pdl_live_|rooferslabs-production' "$API_ENV_FILE" "$WEB_ENV_FILE" 2>/dev/null; then
      echo "FAIL: a production credential is present in a local env file." >&2
      status=1
    fi
    exit $status
    ;;

  write)
    render_api_env > "$API_ENV_FILE"
    render_web_env > "$WEB_ENV_FILE"
    chmod 600 "$API_ENV_FILE" "$WEB_ENV_FILE"
    echo "==> Wrote $API_ENV_FILE"
    echo "==> Wrote $WEB_ENV_FILE"
    echo
    echo "Next:"
    echo "  docker compose -f docker/docker-compose.yml up -d redis"
    echo "  npm run prisma:generate"
    echo "  npm run dev:api     # http://localhost:4000"
    echo "  npm run dev:web     # http://localhost:5173"
    ;;

  *)
    echo "usage: $0 [--print|--check]" >&2
    exit 2
    ;;
esac
