#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — run Prisma against the production database
# =============================================================================
# There is no local database in this project, and there cannot be a direct
# connection to the real one: RDS is not publicly accessible and lives in the
# private subnets. Anything that needs the database therefore runs *inside* the
# VPC, as a one-off ECS task using the same image, the same secrets and the same
# security group as the API itself.
#
#   infra/scripts/db.sh status     # which migrations are applied (default)
#   infra/scripts/db.sh deploy     # apply pending migrations by hand
#
# `deploy` is rarely needed: the API container runs `prisma migrate deploy` on
# every start (docker/api-entrypoint.sh), so shipping the API applies the
# migrations. Use it to apply a migration without a deploy, or to inspect a
# failure.
#
# Nothing here needs DATABASE_URL on your machine. `prisma generate`, `validate`
# and `format` do not touch a database and keep working locally as normal.
#
# Requires: aws CLI (authenticated), jq.
set -euo pipefail

ACTION="${1:-status}"
case "$ACTION" in
  status) PRISMA_CMD="migrate status" ;;
  deploy) PRISMA_CMD="migrate deploy" ;;
  *)
    echo "usage: $0 [status|deploy]" >&2
    exit 2
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"
command -v jq >/dev/null || { echo "error: jq is required." >&2; exit 1; }

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || true; }

CLUSTER="${ECS_CLUSTER:-$(tf_out ecs_cluster_name)}"
SERVICE="${API_SERVICE:-$(tf_out api_service_name)}"
: "${AWS_REGION:=$(tf_out aws_region)}"
export AWS_REGION
[ -n "$CLUSTER" ] && [ -n "$SERVICE" ] || { echo "error: could not resolve the ECS cluster/service." >&2; exit 1; }

# Reuse the running service's task definition and networking so the one-off task
# is identical to production in every way that matters — same image, same
# database secret, same security group.
SERVICE_JSON=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0]' --output json)

TASK_DEF=$(echo "$SERVICE_JSON" | jq -r '.taskDefinition')
# Passed as JSON rather than the CLI's `key=value` shorthand: the shorthand
# parser mangles nested lists and reports a nonsense security-group id.
NETWORK=$(echo "$SERVICE_JSON" | jq -c '{awsvpcConfiguration: .networkConfiguration.awsvpcConfiguration}')

echo "==> prisma $PRISMA_CMD  (one-off task in the API's VPC)"
echo "    task definition: ${TASK_DEF##*/}"

# shellcheck disable=SC2016
OVERRIDES=$(jq -n --arg cmd "$PRISMA_CMD" '{
  containerOverrides: [{
    name: "api",
    command: ["sh", "-c", ("npx prisma " + $cmd + " --schema apps/api/prisma/schema.prisma")],
    environment: [{ name: "MIGRATE_ON_START", value: "false" }]
  }]
}')

TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "$NETWORK" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' --output text)

[ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ] || { echo "error: the task did not start." >&2; exit 1; }
TASK_ID="${TASK_ARN##*/}"
echo "    task: $TASK_ID — waiting…"

aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"

EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)

echo
echo "──────────────── prisma output ────────────────"
# `--output text` joins events with tabs, which flattens multi-line Prisma
# output onto one line; JSON keeps one message per line.
aws logs get-log-events \
  --log-group-name "/rooferslabs-production/api" \
  --log-stream-name "api/api/$TASK_ID" \
  --limit 200 --query 'events[].message' --output json 2>/dev/null |
  jq -r '.[]' | grep -v '^npm notice' | sed 's/^/  /' ||
  echo "  (no log stream yet — try again in a moment)"
echo "───────────────────────────────────────────────"

if [ "$EXIT_CODE" != "0" ]; then
  echo "error: prisma exited $EXIT_CODE." >&2
  exit 1
fi
echo "✅ prisma $PRISMA_CMD completed against production."
