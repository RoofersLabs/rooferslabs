#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — serve the application on app.<root_domain>
# =============================================================================
# Adds app.rooferslabs.com to the production CloudFront distribution. Same shape
# as enable-admin-domain.sh, and for the same reason: CloudFront serves every
# alias from ONE certificate, so adding a hostname means replacing that
# certificate with a superset, and a replacement is PENDING_VALIDATION until its
# CNAMEs exist in Cloudflare — which Terraform does not manage here. So
# `terraform apply` necessarily pauses partway through, waiting for you.
#
# This script starts that apply, watches ACM, and prints the exact records to
# add the moment they exist. You paste them into Cloudflare and the apply
# finishes on its own. rooferslabs.com keeps serving on its current certificate
# the entire time — there is no window where the live site is unreachable.
#
# Usage:
#   infra/scripts/enable-app-domain.sh              # do it
#   PLAN_ONLY=1 infra/scripts/enable-app-domain.sh  # show the plan and stop
#
# Production only: app.<domain> is a production surface. Development is served
# from dev.<domain> by its own distribution.
#
# Requires: terraform, aws CLI (authenticated), jq.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"
LOG="${TMPDIR:-/tmp}/rooferslabs-app-domain.$$.log"

command -v jq >/dev/null || { echo "error: jq is required." >&2; exit 1; }

ROOT_DOMAIN=$(terraform -chdir="$TF_DIR" output -raw root_domain 2>/dev/null || echo "")
if [ -z "$ROOT_DOMAIN" ]; then
  ROOT_DOMAIN=$(grep -E '^\s*root_domain' "$TF_DIR/terraform.tfvars" | head -1 | sed 's/.*=\s*"\(.*\)".*/\1/')
fi
[ -n "$ROOT_DOMAIN" ] || { echo "error: could not determine root_domain." >&2; exit 1; }
APP_HOST="app.${ROOT_DOMAIN}"

VARS=(-var "request_app_certificate=true" -var "enable_app_alias=true")

echo "==> Target hostname: https://${APP_HOST}"
echo "==> Planning…"
terraform -chdir="$TF_DIR" plan -input=false "${VARS[@]}" -no-color | tail -30

if [ "${PLAN_ONLY:-0}" = "1" ]; then
  echo
  echo "PLAN_ONLY set — stopping before apply."
  exit 0
fi

echo
echo "==> Applying. This will PAUSE while the certificate validates —"
echo "    the CNAMEs to add in Cloudflare are printed below as soon as AWS issues them."
echo "    Log: $LOG"
echo

terraform -chdir="$TF_DIR" apply -input=false -auto-approve "${VARS[@]}" -no-color >"$LOG" 2>&1 &
APPLY_PID=$!

# ---- Surface the validation records while the apply waits --------------------
printed=0
while kill -0 "$APPLY_PID" 2>/dev/null; do
  if [ "$printed" -eq 0 ]; then
    ARN=$(aws acm list-certificates --region us-east-1 \
      --certificate-statuses PENDING_VALIDATION \
      --query "CertificateSummaryList[?DomainName=='${ROOT_DOMAIN}'].CertificateArn | [0]" \
      --output text 2>/dev/null || echo "None")

    if [ -n "$ARN" ] && [ "$ARN" != "None" ]; then
      RECORDS=$(aws acm describe-certificate --region us-east-1 --certificate-arn "$ARN" \
        --query 'Certificate.DomainValidationOptions[?ValidationStatus==`PENDING_VALIDATION`].ResourceRecord' \
        --output json 2>/dev/null || echo "[]")
      if [ "$(echo "$RECORDS" | jq 'length')" -gt 0 ]; then
        echo "──────────────────────────────────────────────────────────────────"
        echo " ADD THESE IN CLOUDFLARE — type CNAME, proxy OFF (DNS only)"
        echo "──────────────────────────────────────────────────────────────────"
        echo "$RECORDS" | jq -r '.[] | "  name:  \(.Name)\n  value: \(.Value)\n"'
        echo "  Certificate: $ARN"
        echo "──────────────────────────────────────────────────────────────────"
        echo "Waiting for the certificate to issue, then finishing the apply…"
        printed=1
      fi
    fi
  fi
  sleep 10
done

wait "$APPLY_PID" && APPLY_OK=1 || APPLY_OK=0

if [ "$APPLY_OK" != "1" ]; then
  echo "error: terraform apply failed. Full log:" >&2
  tail -40 "$LOG" >&2
  exit 1
fi

tail -20 "$LOG"

# ---- Verify ------------------------------------------------------------------
DIST_ID=$(terraform -chdir="$TF_DIR" output -raw web_distribution_id)
DIST_DOMAIN=$(terraform -chdir="$TF_DIR" output -raw web_cloudfront_domain)

echo
echo "==> Distribution aliases now:"
aws cloudfront get-distribution-config --id "$DIST_ID" \
  --query 'DistributionConfig.Aliases.Items' --output text | tr '\t' '\n' | sed 's/^/    /'

echo
echo "✅ AWS is ready."
echo
echo "One step left, and only you can do it:"
echo "  Cloudflare → DNS → add  CNAME  ${APP_HOST}  →  ${DIST_DOMAIN}   (proxied ☁️)"
echo
echo "Then verify:"
echo "  curl -sI https://${APP_HOST}/ | head -3     # expect 200"
echo
echo "The API already accepts https://${APP_HOST} as a CORS origin — it is in the"
echo "task definition's CORS_ORIGINS. If the API has not been redeployed since"
echo "that change, run: infra/scripts/deploy.sh production"
