#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build and deploy the frontend SPA to S3 + CloudFront
# =============================================================================
# Usage:
#   infra/scripts/deploy-web.sh
#
# Reads the bucket, distribution, API URL, and Clerk publishable key from
# Terraform outputs (override with env vars). The frontend is a static Vite
# build served from S3 + CloudFront. Requires: node/npm, aws CLI
# (authenticated), terraform (applied at least once).
#
# Fails immediately on any error (build, upload, or invalidation).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"
DIST="$REPO_ROOT/apps/web/dist"

tf_out() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null; }

BUCKET="${WEB_BUCKET:-$(tf_out web_bucket)}"
DISTRIBUTION_ID="${WEB_DISTRIBUTION_ID:-$(tf_out web_distribution_id)}"
: "${VITE_API_BASE_URL:=$(tf_out api_url)}"
: "${VITE_CLERK_PUBLISHABLE_KEY:=$(tf_out clerk_publishable_key)}"
export VITE_API_BASE_URL VITE_CLERK_PUBLISHABLE_KEY

if [ -z "${BUCKET:-}" ] || [ -z "${DISTRIBUTION_ID:-}" ]; then
  echo "error: could not resolve web_bucket / web_distribution_id from Terraform." >&2
  echo "       Run 'terraform apply' first, or set WEB_BUCKET / WEB_DISTRIBUTION_ID." >&2
  exit 1
fi
if [ -z "${VITE_API_BASE_URL:-}" ] || [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ]; then
  echo "error: VITE_API_BASE_URL and VITE_CLERK_PUBLISHABLE_KEY are required for the build." >&2
  exit 1
fi

echo "==> Building web (VITE_API_BASE_URL=$VITE_API_BASE_URL)…"
npm ci --prefix "$REPO_ROOT" >/dev/null
npm run build --workspace @rooferslabs/shared --prefix "$REPO_ROOT"
npm run build --workspace @rooferslabs/web --prefix "$REPO_ROOT"

test -f "$DIST/index.html" || { echo "error: build produced no dist/index.html" >&2; exit 1; }

# ---- Upload -----------------------------------------------------------------
# Pass 1: everything except the entry/PWA control files → immutable (all names
# under assets/ and workbox-*.js are content-hashed). --delete prunes old
# hashed assets; excluded files are neither compared nor deleted.
echo "==> Uploading hashed assets (immutable)…"
aws s3 sync "$DIST/" "s3://$BUCKET/" --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.webmanifest" \
  --exclude "sw.js" \
  --exclude "push-sw.js" \
  --exclude "registerSW.js"

# Pass 2: entry + PWA control files → no-cache so updates are picked up.
echo "==> Uploading entry + service worker (no-cache)…"
aws s3 cp "$DIST/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"
for f in sw.js push-sw.js registerSW.js; do
  [ -f "$DIST/$f" ] && aws s3 cp "$DIST/$f" "s3://$BUCKET/$f" \
    --cache-control "no-cache" --content-type "application/javascript"
done
for m in "$DIST"/*.webmanifest; do
  [ -f "$m" ] && aws s3 cp "$m" "s3://$BUCKET/$(basename "$m")" \
    --cache-control "no-cache" --content-type "application/manifest+json"
done

# ---- Invalidate the always-fresh paths --------------------------------------
echo "==> Invalidating CloudFront…"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" "/sw.js" "/push-sw.js" "/registerSW.js" "/manifest.webmanifest" \
  --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" --id "$INVALIDATION_ID"

# ---- Verify -----------------------------------------------------------------
CF_DOMAIN=$(tf_out web_cloudfront_domain)
echo "==> Verifying https://$CF_DOMAIN/ …"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "https://$CF_DOMAIN/")
if [ "$STATUS" != "200" ]; then
  echo "error: verification GET returned HTTP $STATUS (expected 200)." >&2
  exit 1
fi

echo "✅ Deployed frontend to s3://$BUCKET via CloudFront $DISTRIBUTION_ID (HTTP $STATUS)."
