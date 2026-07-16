#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build, push, and deploy application images to ECS
# =============================================================================
# Usage:
#   infra/scripts/deploy.sh            # build + deploy api and web
#   infra/scripts/deploy.sh api        # api only
#   infra/scripts/deploy.sh web        # web only
#
# Requires: docker, aws CLI (authenticated), terraform (applied at least once).
# All configuration is read from Terraform outputs — nothing to edit here.
set -euo pipefail

TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

echo "Reading Terraform outputs…"
AWS_REGION=$(tf_out aws_region)
CLUSTER=$(tf_out ecs_cluster_name)
API_REPO=$(terraform -chdir="$TF_DIR" output -json ecr_repository_urls | python3 -c 'import json,sys; print(json.load(sys.stdin)["api"])')
WEB_REPO=$(terraform -chdir="$TF_DIR" output -json ecr_repository_urls | python3 -c 'import json,sys; print(json.load(sys.stdin)["web"])')
API_SERVICE=$(tf_out api_service_name)
WEB_SERVICE=$(tf_out web_service_name)
API_URL=$(tf_out api_url)
CLERK_PK=$(tf_out clerk_publishable_key)
GIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD)

REGISTRY="${API_REPO%%/*}"
echo "Logging in to ECR ($REGISTRY)…"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

build_push() {
  local name="$1" dockerfile="$2" repo="$3"; shift 3
  echo "==> Building $name ($GIT_SHA)…"
  # Fargate runs linux/amd64 — force the platform (matters on Apple Silicon).
  docker build --platform linux/amd64 -f "$REPO_ROOT/$dockerfile" \
    -t "$repo:latest" -t "$repo:$GIT_SHA" "$@" "$REPO_ROOT"
  docker push "$repo:latest"
  docker push "$repo:$GIT_SHA"
}

redeploy() {
  local service="$1"
  echo "==> Deploying $service…"
  aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" \
    --service "$service" --force-new-deployment --no-cli-pager >/dev/null
}

if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  build_push "api" "docker/api.Dockerfile" "$API_REPO"
  redeploy "$API_SERVICE"
fi

if [ "$TARGET" = "web" ] || [ "$TARGET" = "all" ]; then
  build_push "web" "docker/web.Dockerfile" "$WEB_REPO" \
    --build-arg "VITE_CLERK_PUBLISHABLE_KEY=$CLERK_PK" \
    --build-arg "VITE_API_BASE_URL=$API_URL"
  redeploy "$WEB_SERVICE"
fi

echo "==> Waiting for services to stabilize…"
SERVICES=()
[ "$TARGET" != "web" ] && SERVICES+=("$API_SERVICE")
[ "$TARGET" != "api" ] && SERVICES+=("$WEB_SERVICE")
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "${SERVICES[@]}"

echo "✅ Deployed $TARGET ($GIT_SHA)."
