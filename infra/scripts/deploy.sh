#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build, push, and deploy the API image to ECS
# =============================================================================
# Usage:
#   infra/scripts/deploy.sh
#
# The frontend deploys to S3 + CloudFront via infra/scripts/deploy-web.sh;
# this script handles the backend (ECS) only.
#
# Requires: docker, aws CLI (authenticated), terraform (applied at least once).
# All configuration is read from Terraform outputs — nothing to edit here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1"; }

echo "Reading Terraform outputs…"
AWS_REGION=$(tf_out aws_region)
CLUSTER=$(tf_out ecs_cluster_name)
API_REPO=$(terraform -chdir="$TF_DIR" output -json ecr_repository_urls | python3 -c 'import json,sys; print(json.load(sys.stdin)["api"])')
API_SERVICE=$(tf_out api_service_name)
GIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD)

REGISTRY="${API_REPO%%/*}"
echo "Logging in to ECR ($REGISTRY)…"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Building api ($GIT_SHA)…"
# Fargate runs linux/amd64 — force the platform (matters on Apple Silicon).
docker build --platform linux/amd64 -f "$REPO_ROOT/docker/api.Dockerfile" \
  -t "$API_REPO:latest" -t "$API_REPO:$GIT_SHA" "$REPO_ROOT"
docker push "$API_REPO:latest"
docker push "$API_REPO:$GIT_SHA"

echo "==> Deploying ${API_SERVICE}..."

aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" \
  --service "$API_SERVICE" --force-new-deployment --no-cli-pager >/dev/null

echo "==> Waiting for the service to stabilize…"
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "$API_SERVICE"

echo "✅ Deployed api ($GIT_SHA). Frontend deploys via infra/scripts/deploy-web.sh."
