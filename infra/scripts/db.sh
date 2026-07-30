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
#   infra/scripts/db.sh status              # which migrations are applied (default)
#   infra/scripts/db.sh deploy              # apply pending migrations by hand
#   infra/scripts/db.sh platform-users      # who can reach the admin portal
#   infra/scripts/db.sh grant-owner <email> # give an account platform access
#   infra/scripts/db.sh revoke-owner <email>
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
EMAIL="${2:-}"

# Platform access is granted by hand, deliberately. There is no self-service
# path to it and no endpoint that sets it: a role that reads every tenant's data
# should require someone with database access to decide, and leave a record of
# having decided. `node -e` rather than raw SQL so the update goes through the
# same Prisma client and enum the application uses — a typo in a role name fails
# here instead of writing a value nothing can read.
node_script() {
  printf 'node -e %s' "$(printf '%s' "$1" | sed 's/"/\\"/g; s/^/"/; s/$/"/')"
}

case "$ACTION" in
  status) PRISMA_CMD="migrate status" ;;
  deploy) PRISMA_CMD="migrate deploy" ;;
  platform-users | grant-owner | revoke-owner) PRISMA_CMD="" ;;
  *)
    echo "usage: $0 [status|deploy|platform-users|grant-owner <email>|revoke-owner <email>]" >&2
    exit 2
    ;;
esac

case "$ACTION" in
  grant-owner | revoke-owner)
    [ -n "$EMAIL" ] || { echo "usage: $0 $ACTION <email>" >&2; exit 2; }
    ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"

# Only the WRITE actions are branch-gated (see the case below). `status` and
# `platform-users` read production and answer questions you need answered while
# working on a branch — gating those would train people to bypass the guard
# rather than respect it.
# shellcheck source=lib/require-main-branch.sh
source "$(dirname "$0")/lib/require-main-branch.sh"

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

echo "==> $ACTION  (one-off task in the API's VPC)"
echo "    task definition: ${TASK_DEF##*/}"

# This script targets PRODUCTION and only production — TF_DIR is pinned to
# envs/production above. Local development has its own database, reachable
# directly with ordinary Prisma commands (see infra/scripts/dev-env.sh), so
# there is no longer any reason to reach for this during normal development.
#
# `deploy` and the grant/revoke actions write to the live database. Require the
# intent to be typed out rather than arriving via shell history or a stray
# repeat of the last command.
case "$ACTION" in
  deploy | grant-owner | revoke-owner)
    require_main_branch "run '$ACTION' against the production database"
    if [ "${DB_CONFIRM:-}" != "production" ]; then
      echo
      echo "    This writes to the PRODUCTION database ($CLUSTER)."
      printf "    Type 'production' to continue: "
      read -r reply
      [ "$reply" = "production" ] || { echo "aborted." >&2; exit 1; }
    fi
    ;;
esac

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
  --log-group-name "/rooferslabs-production/api" \
  --log-stream-name "api/api/$TASK_ID" \
  --limit 200 --query 'events[].message' --output json 2>/dev/null |
  jq -r '.[]' | grep -v '^npm notice' | sed 's/^/  /' ||
  echo "  (no log stream yet — try again in a moment)"
echo "────────────────────────────────────────"

if [ "$EXIT_CODE" != "0" ]; then
  echo "error: the task exited $EXIT_CODE." >&2
  exit 1
fi
echo "✅ $ACTION completed against production."
