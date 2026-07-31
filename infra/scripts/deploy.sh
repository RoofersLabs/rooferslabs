#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build, push, and deploy the API image to ECS
# =============================================================================
# Usage:
#   infra/scripts/deploy.sh development       # deploy the development API
#   infra/scripts/deploy.sh production        # deploy the production API
#   infra/scripts/deploy.sh                   # infer from the current branch
#   SKIP_BUILD=1 infra/scripts/deploy.sh dev  # re-roll the service on its current image
#
# Which environment this deploys to is resolved by infra/scripts/env.sh — from
# the argument, $ENVIRONMENT, or the branch, in that order, and never guessed.
# Production additionally refuses to ship from anything but `main`.
#
# The frontend deploys to S3 + CloudFront via infra/scripts/deploy-web.sh;
# this script handles the backend (ECS) only.
#
# Configuration resolves from that environment's Terraform outputs; every value
# can be overridden with an environment variable, so the script also runs where
# no Terraform state is present (e.g. CI):
#   AWS_REGION, ECS_CLUSTER, API_SERVICE, API_REPO, API_HEALTH_URL
#
# Requires: docker, aws CLI (authenticated). Terraform only when the values
# above are not supplied.
#
# Fails immediately on any error (build, push, rollout, or verification).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=infra/scripts/env.sh
. "$REPO_ROOT/infra/scripts/env.sh"

rl_resolve_environment "${1:-}"
rl_guard_branch

: "${AWS_REGION:=$(tf_out aws_region)}"
: "${ECS_CLUSTER:=$(tf_out ecs_cluster_name)}"
: "${API_SERVICE:=$(tf_out api_service_name)}"
: "${API_HEALTH_URL:=$(tf_out api_url)/v1/health}"
if [ -z "${API_REPO:-}" ]; then
  API_REPO=$(tf_out_json ecr_repository_urls \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["api"])' 2>/dev/null || true)
fi
export AWS_REGION

rl_require AWS_REGION ECS_CLUSTER API_SERVICE API_REPO

rl_banner "Deploying the API"
echo "  cluster:  $ECS_CLUSTER"
echo "  service:  $API_SERVICE"
echo "  registry: $API_REPO"
echo "  health:   $API_HEALTH_URL"
echo

GIT_SHA=$(git -C "$REPO_ROOT" rev-parse --short HEAD)

# ---- Build and push ---------------------------------------------------------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  REGISTRY="${API_REPO%%/*}"
  echo "==> Logging in to ECR ($REGISTRY)…"
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$REGISTRY"

  echo "==> Building api ($GIT_SHA)…"
  # Fargate runs linux/amd64 — force the platform (matters on Apple Silicon).
  docker build --platform linux/amd64 -f "$REPO_ROOT/docker/api.Dockerfile" \
    -t "$API_REPO:latest" -t "$API_REPO:$GIT_SHA" "$REPO_ROOT"

  # Push the immutable tag FIRST. If the run dies between the two pushes, the
  # sha tag existing without :latest moving is recoverable; the reverse would
  # leave :latest pointing at an image with no traceable commit.
  docker push "$API_REPO:$GIT_SHA"
  docker push "$API_REPO:latest"
fi

# ---- Roll out ---------------------------------------------------------------
echo "==> Deploying ${API_SERVICE}…"
aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER" \
  --service "$API_SERVICE" --force-new-deployment --no-cli-pager >/dev/null

echo "==> Waiting for the service to stabilize…"
aws ecs wait services-stable --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" --services "$API_SERVICE"

# ---- Verify -----------------------------------------------------------------
# `services-stable` only proves the tasks passed the ALB health check; hit the
# public URL so a broken listener/DNS path fails the deploy too.
#
# SKIP_VERIFY exists for exactly one situation: the first deploy of a new
# environment, whose hostname has no DNS record yet because nothing has been
# deployed for it to point at. Using it on an environment that is already live
# turns a deploy into a hope.
if [ "${SKIP_VERIFY:-0}" = "1" ]; then
  echo "==> Skipping the public health check (SKIP_VERIFY=1)."
  echo "    Task health was still proven by 'ecs wait services-stable' above."
  STATUS="unverified"
else
  echo "==> Verifying $API_HEALTH_URL …"
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$API_HEALTH_URL")
  if [ "$STATUS" != "200" ]; then
    echo "error: health check returned HTTP $STATUS (expected 200)." >&2
    exit 1
  fi
  STATUS="HTTP $STATUS"
fi

echo "✅ Deployed api ($GIT_SHA) to $ENVIRONMENT — $ECS_CLUSTER/$API_SERVICE ($STATUS)."
