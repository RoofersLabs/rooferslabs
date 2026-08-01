#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — provision PayPal billing against a deployed environment
# =============================================================================
#   infra/scripts/billing.sh development setup    # provision the catalogue
#   infra/scripts/billing.sh production  setup
#   infra/scripts/billing.sh development status   # readiness, without writing
#
# This is what `npm run billing:paypal:setup` runs.
#
# ## Why it cannot run on your machine
#
# Provisioning writes the ids PayPal issues into the `billing_catalog` table, so
# it needs the environment's database. Every RDS instance in this project is
# `publicly_accessible = false`, sits in private subnets, and accepts ingress
# only from the API's security group — there is no route from a laptop to any
# environment's database, deliberately.
#
# So provisioning runs where the database is reachable: as a one-off ECS task on
# the environment's own task definition, exactly as infra/scripts/db.sh runs
# Prisma. That task inherits the same image, the same DATABASE_URL secret, the
# same PayPal credentials and the same security group as the running API, which
# is what makes "provisioned" mean the same thing to this command and to the
# service that will serve the checkout.
#
# There is consequently nothing to configure locally: no DATABASE_URL, no
# Postgres, no Redis, no tunnel. The environment argument is the only input.
#
# Requires: aws CLI (authenticated), jq.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=infra/scripts/env.sh
. "$REPO_ROOT/infra/scripts/env.sh"

# The environment is optional-but-first, matching db.sh. Dropped from the
# argument list only when actually present, so `billing.sh setup` still works on
# a branch whose environment can be inferred.
if [ -n "$(rl_normalize_environment "${1:-}")" ]; then
  rl_resolve_environment "$1"
  shift
else
  rl_resolve_environment ""
fi

ACTION="${1:-setup}"

case "$ACTION" in
  setup)
    # Creates what is missing and records it. Idempotent: a second run reports
    # everything as reused and writes nothing.
    CONTAINER_CMD="node apps/api/dist/billing/provisioning/paypal-setup.cli.js"
    ;;
  status)
    # Read-only. Answers "can this environment take money?" without touching
    # PayPal's catalogue — useful after a deploy, and safe on production.
    CONTAINER_CMD="node -e \"require('http').get('http://127.0.0.1:4000/v1/health/billing',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{console.log(d);process.exit(0)})}).on('error',e=>{console.error(e.message);process.exit(1)})\""
    echo "note: 'status' reads the running service; use the API's /v1/health/billing directly for the same answer." >&2
    ;;
  *)
    echo "usage: $0 [development|production] [setup|status]" >&2
    exit 2
    ;;
esac

command -v jq >/dev/null || { echo "error: jq is required." >&2; exit 1; }

CLUSTER="${ECS_CLUSTER:-$(tf_out ecs_cluster_name)}"
SERVICE="${API_SERVICE:-$(tf_out api_service_name)}"
LOG_GROUP="${API_LOG_GROUP:-$(tf_out api_log_group_name)}"
: "${AWS_REGION:=$(tf_out aws_region)}"
export AWS_REGION
rl_require CLUSTER SERVICE

# Reuse the running service's task definition and networking so the one-off task
# is identical to the environment it targets in every way that matters — same
# image, same secrets, same subnets, same security group.
SERVICE_JSON=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0]' --output json)

TASK_DEF=$(echo "$SERVICE_JSON" | jq -r '.taskDefinition')
# Passed as JSON rather than the CLI's `key=value` shorthand: the shorthand
# parser mangles nested lists and reports a nonsense security-group id.
NETWORK=$(echo "$SERVICE_JSON" | jq -c '{awsvpcConfiguration: .networkConfiguration.awsvpcConfiguration}')

echo "==> billing $ACTION on $ENVIRONMENT  (one-off task in the API's VPC)"
echo "    task definition: ${TASK_DEF##*/}"

# MIGRATE_ON_START=false so a provisioning run never also applies migrations —
# one job per task, and a schema change should be a deploy, not a side effect of
# creating a plan.
OVERRIDES=$(jq -n --arg cmd "$CONTAINER_CMD" '{
  containerOverrides: [{
    name: "api",
    command: ["sh", "-c", $cmd],
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
echo "──────────────── output ────────────────"
# JSON rather than `--output text`: the latter joins events with tabs, which
# flattens the provisioning report onto a single unreadable line.
aws logs get-log-events \
  --log-group-name "${LOG_GROUP:-/rooferslabs-$ENVIRONMENT/api}" \
  --log-stream-name "api/api/$TASK_ID" \
  --limit 300 --query 'events[].message' --output json 2>/dev/null |
  jq -r '.[]' | grep -v '^npm notice' | sed 's/^/  /' ||
  echo "  (no log stream yet — try again in a moment)"
echo "────────────────────────────────────────"

if [ "$EXIT_CODE" != "0" ]; then
  echo "error: the task exited $EXIT_CODE." >&2
  exit 1
fi
echo "✅ billing $ACTION completed against $ENVIRONMENT."
