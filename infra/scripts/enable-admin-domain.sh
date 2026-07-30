#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — expose the admin portal on admin.<root_domain>
# =============================================================================
# Runs the whole change except the two things only you can do: adding DNS records
# in Cloudflare, and granting yourself the platform role.
#
# Why it is shaped like this
# --------------------------
# CloudFront serves every alias from ONE certificate, so adding a hostname means
# replacing the certificate with a superset. A replacement is PENDING_VALIDATION
# until its CNAMEs exist in DNS, and Cloudflare is not Terraform-managed here —
# so `terraform apply` necessarily pauses partway through, waiting for you.
#
# This script starts that apply, then watches ACM and prints the exact records to
# add the moment they exist. You paste two CNAMEs into Cloudflare and the apply
# finishes on its own. The live site keeps serving on its current certificate the
# entire time.
#
# Usage:
#   infra/scripts/enable-admin-domain.sh              # do it
#   PLAN_ONLY=1 infra/scripts/enable-admin-domain.sh  # show the plan and stop
#
# Requires: terraform, aws CLI (authenticated), jq.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"
LOG="${TMPDIR:-/tmp}/rooferslabs-admin-domain.$$.log"

command -v jq >/dev/null || { echo "error: jq is required." >&2; exit 1; }

ROOT_DOMAIN=$(terraform -chdir="$TF_DIR" output -raw root_domain 2>/dev/null || echo "")
if [ -z "$ROOT_DOMAIN" ]; then
  # Not exported as an output; read it from the variables file instead.
  ROOT_DOMAIN=$(grep -E '^\s*root_domain' "$TF_DIR/terraform.tfvars" | head -1 | sed 's/.*=\s*"\(.*\)".*/\1/')
fi
[ -n "$ROOT_DOMAIN" ] || { echo "error: could not determine root_domain." >&2; exit 1; }
ADMIN_HOST="admin.${ROOT_DOMAIN}"

VARS=(-var "request_admin_certificate=true" -var "enable_admin_alias=true")

echo "==> Target hostname: https://${ADMIN_HOST}"
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
echo "  Cloudflare → DNS → add  CNAME  ${ADMIN_HOST}  →  ${DIST_DOMAIN}   (proxied ☁️)"
echo
echo "Then verify:"
echo "  curl -sI https://${ADMIN_HOST}/ | head -3     # expect 302 → /admin"
echo "  open https://${ADMIN_HOST}"
