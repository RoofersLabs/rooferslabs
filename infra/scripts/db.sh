#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — run Prisma against a deployed database
# =============================================================================
# Neither database is reachable from a laptop: both RDS instances live in
# private subnets with no public endpoint. Anything that needs one therefore
# runs *inside* the VPC, as a one-off ECS task using that environment's own
# image, secrets and security group.
#
#   infra/scripts/db.sh development status         # which migrations are applied
#   infra/scripts/db.sh production  status
#   infra/scripts/db.sh development deploy         # apply pending migrations
#   infra/scripts/db.sh production  platform-users # who can reach the admin portal
#   infra/scripts/db.sh production  grant-owner <email>
#   infra/scripts/db.sh production  revoke-owner <email>
#
# The environment is the first argument. It can be omitted on the main/develop
# branches, where it is inferred — but naming it is the better habit for a
# command that writes to a database.
#
# `deploy` is rarely needed: the API container runs `prisma migrate deploy` on
# every start (docker/api-entrypoint.sh), so shipping the API applies the
# migrations. Use it to apply a migration without a deploy, or to inspect a
# failure.
#
# Nothing here needs DATABASE_URL on your machine, and there is no way for it to
# reach the wrong environment's database: the task inherits the connection
# string from that environment's own Secrets Manager entry.
#
# Requires: aws CLI (authenticated), jq.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=infra/scripts/env.sh
. "$REPO_ROOT/infra/scripts/env.sh"

# The environment is optional-but-first. Drop it from the argument list only
# when it is actually there, so `db.sh status` keeps working on a known branch.
if [ -n "$(rl_normalize_environment "${1:-}")" ]; then
  rl_resolve_environment "$1"
  shift
else
  rl_resolve_environment ""
fi

ACTION="${1:-status}"
EMAIL="${2:-}"

# Platform access is granted by hand, deliberately. There is no self-service
# path to it and no endpoint that sets it: a role that reads every tenant's data
# should require someone with database access to decide, and leave a record of
# having decided. `node -e` rather than raw SQL so the update goes through the
# same Prisma client and enum the application uses — a typo in a role name fails
# here instead of writing a value nothing can read.

case "$ACTION" in
  status) PRISMA_CMD="migrate status" ;;
  deploy) PRISMA_CMD="migrate deploy" ;;
  platform-users | grant-owner | revoke-owner) PRISMA_CMD="" ;;
  *)
    echo "usage: $0 [production|development] [status|deploy|platform-users|grant-owner <email>|revoke-owner <email>]" >&2
    exit 2
    ;;
esac

case "$ACTION" in
  grant-owner | revoke-owner)
    [ -n "$EMAIL" ] || { echo "usage: $0 [environment] $ACTION <email>" >&2; exit 2; }
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
# image, same database secret, same security group.
SERVICE_JSON=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0]' --output json)

TASK_DEF=$(echo "$SERVICE_JSON" | jq -r '.taskDefinition')
# Passed as JSON rather than the CLI's `key=value` shorthand: the shorthand
# parser mangles nested lists and reports a nonsense security-group id.
NETWORK=$(echo "$SERVICE_JSON" | jq -c '{awsvpcConfiguration: .networkConfiguration.awsvpcConfiguration}')

echo "==> $ACTION on $ENVIRONMENT  (one-off task in the API's VPC)"
echo "    task definition: ${TASK_DEF##*/}"

case "$ACTION" in
  status | deploy)
    CONTAINER_CMD="npx prisma $PRISMA_CMD --schema apps/api/prisma/schema.prisma"
    ;;
  platform-users)
    CONTAINER_CMD='node -e "const{PrismaClient}=require(\"@prisma/client\");const p=new PrismaClient();p.user.findMany({where:{platformRole:\"OWNER\",deletedAt:null},select:{id:true,email:true,clerkUserId:true}}).then(u=>console.log(u.length?JSON.stringify(u,null,1):\"No accounts hold platform access.\")).finally(()=>p.\$disconnect())"'
    ;;
  grant-owner | revoke-owner)
    ROLE=$([ "$ACTION" = "grant-owner" ] && echo OWNER || echo NONE)
    # Matched on email and reported by count, so granting to a typo — or to an
    # address that turns out to have two records — is visible rather than silent.
    CONTAINER_CMD="node -e \"const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.updateMany({where:{email:'$EMAIL',deletedAt:null},data:{platformRole:'$ROLE'}}).then(r=>p.user.findMany({where:{email:'$EMAIL',deletedAt:null},select:{id:true,email:true,platformRole:true}}).then(u=>console.log('updated '+r.count+' record(s): '+JSON.stringify(u)))).finally(()=>p.\\\$disconnect())\""
    ;;
esac

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
# `--output text` joins events with tabs, which flattens multi-line Prisma
# output onto one line; JSON keeps one message per line.
aws logs get-log-events \
  --log-group-name "${LOG_GROUP:-/rooferslabs-$ENVIRONMENT/api}" \
  --log-stream-name "api/api/$TASK_ID" \
  --limit 200 --query 'events[].message' --output json 2>/dev/null |
  jq -r '.[]' | grep -v '^npm notice' | sed 's/^/  /' ||
  echo "  (no log stream yet — try again in a moment)"
echo "────────────────────────────────────────"

if [ "$EXIT_CODE" != "0" ]; then
  echo "error: the task exited $EXIT_CODE." >&2
  exit 1
fi
echo "✅ $ACTION completed against $ENVIRONMENT."
