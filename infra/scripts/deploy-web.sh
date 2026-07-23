#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build and deploy the frontend SPA to S3 + CloudFront
# =============================================================================
# Usage:
#   infra/scripts/deploy-web.sh              # clean install, build, deploy
#   SKIP_INSTALL=1 infra/scripts/deploy-web.sh
#   SKIP_BUILD=1   infra/scripts/deploy-web.sh   # deploy the existing dist/
#
# This script is SELF-CONTAINED: it is the only thing needed to ship the
# frontend. GitHub Actions is a convenience wrapper around this same script
# (.github/workflows/deploy-web.yml) and may fail or be disabled entirely
# without affecting a local deploy.
#
# Configuration resolves from Terraform outputs; every value can be overridden
# with an environment variable, so the script also runs where no Terraform state
# is present (e.g. CI):
#   WEB_BUCKET, WEB_DISTRIBUTION_ID, VITE_API_BASE_URL,
#   VITE_CLERK_PUBLISHABLE_KEY, WEB_VERIFY_URL
#
# Requires: node/npm, aws CLI (authenticated). Terraform only when the values
# above are not supplied.
#
# Fails immediately on any error (build, upload, invalidation, or verification).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform/envs/production"
DIST="$REPO_ROOT/apps/web/dist"

# Terraform is optional — never let a missing binary or state abort the script
# before the environment-variable overrides have had their say.
tf_out() { terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || true; }

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

# ---- Build ------------------------------------------------------------------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building web (VITE_API_BASE_URL=$VITE_API_BASE_URL)…"
  [ "${SKIP_INSTALL:-0}" = "1" ] || npm ci --prefix "$REPO_ROOT" >/dev/null
  # Start from an empty dist/. Vite empties it too, but a stale or duplicated
  # file left behind by an editor/sync tool would otherwise be synced to S3 and
  # served from the production origin.
  rm -rf "$DIST"
  npm run build --workspace @rooferslabs/shared --prefix "$REPO_ROOT"
  npm run build --workspace @rooferslabs/web --prefix "$REPO_ROOT"
fi

test -f "$DIST/index.html" || { echo "error: build produced no dist/index.html" >&2; exit 1; }

# ---- Upload -----------------------------------------------------------------
# Three cache classes, by how the file is named:
#
#   immutable  assets/* and workbox-*.js — content-hashed, so a new build emits
#              a new name. Safe to cache for a year.
#   short      favicon.svg, apple-touch-icon.png, icons/* — served from stable
#              names, so they must NEVER be immutable or a replaced icon can
#              never reach a returning browser. One hour + invalidation.
#   no-cache   index.html and the PWA control files — always revalidated, so
#              the browser can never boot an old build.
echo "==> Uploading hashed assets (immutable)…"
aws s3 sync "$DIST/" "s3://$BUCKET/" --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.webmanifest" \
  --exclude "sw.js" \
  --exclude "push-sw.js" \
  --exclude "registerSW.js" \
  --exclude "favicon.svg" \
  --exclude "apple-touch-icon.png" \
  --exclude "icons/*"

echo "==> Uploading unhashed static assets (short cache)…"
aws s3 sync "$DIST/" "s3://$BUCKET/" \
  --cache-control "public,max-age=3600" \
  --exclude "*" \
  --include "favicon.svg" \
  --include "apple-touch-icon.png" \
  --include "icons/*"

echo "==> Uploading entry + service worker (no-cache)…"
aws s3 cp "$DIST/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"
# These are optional (a missing one is skipped), but a FAILED upload must still
# abort — hence an `if`, not a `[ -f … ] && aws …` list, whose false test would
# itself become the loop's non-zero exit status under `set -e`.
for f in sw.js push-sw.js registerSW.js; do
  if [ -f "$DIST/$f" ]; then
    aws s3 cp "$DIST/$f" "s3://$BUCKET/$f" \
      --cache-control "no-cache" --content-type "application/javascript"
  fi
done
for m in "$DIST"/*.webmanifest; do
  if [ -f "$m" ]; then
    aws s3 cp "$m" "s3://$BUCKET/$(basename "$m")" \
      --cache-control "no-cache" --content-type "application/manifest+json"
  fi
done

# ---- Invalidate -------------------------------------------------------------
# "/*", not a hand-listed set of paths. A list can never cover the SPA deep-link
# routes (every unknown path is a separate cache entry served from index.html
# via the 403/404 mapping) nor the bare "/" entry, which is a DIFFERENT cache
# key from "/index.html". CloudFront bills a wildcard as a single path, and the
# immutable assets it clears are re-fetched under new hashed names anyway.
echo "==> Invalidating CloudFront…"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text)
if [ -z "$INVALIDATION_ID" ] || [ "$INVALIDATION_ID" = "None" ]; then
  echo "error: CloudFront did not return an invalidation id." >&2
  exit 1
fi
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" --id "$INVALIDATION_ID"
echo "    invalidation $INVALIDATION_ID completed."

# ---- Verify -----------------------------------------------------------------
VERIFY_URL="${WEB_VERIFY_URL:-https://$(tf_out web_cloudfront_domain)}"
echo "==> Verifying $VERIFY_URL/ …"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$VERIFY_URL/")
if [ "$STATUS" != "200" ]; then
  echo "error: verification GET returned HTTP $STATUS (expected 200)." >&2
  exit 1
fi

echo "✅ Deployed frontend to s3://$BUCKET via CloudFront $DISTRIBUTION_ID (HTTP $STATUS)."
