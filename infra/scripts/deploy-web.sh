#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — build and deploy the frontend SPA to S3 + CloudFront
# =============================================================================
# Usage:
#   infra/scripts/deploy-web.sh development   # deploy the development SPA
#   infra/scripts/deploy-web.sh production    # deploy the production SPA
#   infra/scripts/deploy-web.sh               # infer from the current branch
#   SKIP_INSTALL=1 infra/scripts/deploy-web.sh dev
#   SKIP_BUILD=1   infra/scripts/deploy-web.sh dev   # deploy the existing dist/
#
# Which environment this deploys to is resolved by infra/scripts/env.sh — from
# the argument, $ENVIRONMENT, or the branch, in that order, and never guessed.
#
# This script is SELF-CONTAINED: it is the only thing needed to ship the
# frontend. GitHub Actions is a convenience wrapper around this same script
# (.github/workflows/deploy-web.yml) and may fail or be disabled entirely
# without affecting a local deploy.
#
# It is also the ONLY correct way to build the SPA. Vite inlines its
# configuration at build time, so `npm run build` on its own bakes in whatever
# happens to be in apps/web/.env — the wrong API origin, and possibly the wrong
# Clerk instance. Here both come from the target environment's Terraform
# outputs, which is what makes "the development site cannot talk to the
# production API" a property of the build rather than a habit.
#
# Configuration resolves from that environment's Terraform outputs; every value
# can be overridden with an environment variable, so the script also runs where
# no Terraform state is present (e.g. CI):
#   WEB_BUCKET, WEB_DISTRIBUTION_ID, VITE_API_BASE_URL,
#   VITE_CLERK_PUBLISHABLE_KEY, WEB_VERIFY_URL
#
# Requires: node/npm, aws CLI (authenticated). Terraform only when the values
# above are not supplied.
#
# Fails immediately on any error (build, upload, invalidation, or verification).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=infra/scripts/env.sh
. "$REPO_ROOT/infra/scripts/env.sh"

rl_resolve_environment "${1:-}"
rl_guard_branch

DIST="$REPO_ROOT/apps/web/dist"

BUCKET="${WEB_BUCKET:-$(tf_out web_bucket)}"
DISTRIBUTION_ID="${WEB_DISTRIBUTION_ID:-$(tf_out web_distribution_id)}"
: "${VITE_API_BASE_URL:=$(tf_out api_url)}"
: "${VITE_CLERK_PUBLISHABLE_KEY:=$(tf_out clerk_publishable_key)}"
export VITE_API_BASE_URL VITE_CLERK_PUBLISHABLE_KEY

rl_require BUCKET DISTRIBUTION_ID VITE_API_BASE_URL VITE_CLERK_PUBLISHABLE_KEY

# The cross-environment check that matters most, because it is the one a person
# cannot see by looking at the built site: a bundle carrying the other
# environment's API origin would work perfectly until it started reading and
# writing the wrong database.
case "$ENVIRONMENT" in
  production)
    case "$VITE_API_BASE_URL" in
      *//api.dev.* | *//dev.* | *localhost*)
        echo "error: production build points at a development API ($VITE_API_BASE_URL)." >&2
        exit 1
        ;;
    esac
    ;;
  development)
    case "$VITE_API_BASE_URL" in
      *//api.dev.* | *localhost*) ;;
      *)
        echo "error: development build points at '$VITE_API_BASE_URL', which is not a development API origin." >&2
        echo "       Refusing to publish a development site wired to production." >&2
        exit 1
        ;;
    esac
    ;;
esac

# The Clerk instance is decided in two places that cannot see each other: this
# key (GitHub Environment secret VITE_CLERK_PUBLISHABLE_KEY, baked into the
# bundle) and CLERK_SECRET_KEY in the environment's Secrets Manager entry
# (Terraform's clerk_secret_key). They must name the SAME instance — the API
# verifies a token against the JWKS belonging to its secret key, so a bundle
# signing users in to the live instance while the API holds a test key makes
# every authenticated request 401 with nothing wrong on either side alone.
#
# The tier prefix is the only part of the pair checkable from here, and it is
# exactly the half that diverged: pinning it to the environment means a bundle
# can never silently change instances without the API being moved to match.
case "$ENVIRONMENT" in
  production)
    case "$VITE_CLERK_PUBLISHABLE_KEY" in
      pk_live_*) ;;
      *)
        echo "error: production build carries a non-live Clerk key (${VITE_CLERK_PUBLISHABLE_KEY:0:8}…)." >&2
        echo "       Production must authenticate against the live Clerk instance." >&2
        echo "       Fix the GitHub Environment secret VITE_CLERK_PUBLISHABLE_KEY (production)," >&2
        echo "       or clerk_publishable_key in infra/terraform/envs/production." >&2
        exit 1
        ;;
    esac
    ;;
  development)
    case "$VITE_CLERK_PUBLISHABLE_KEY" in
      pk_test_*) ;;
      *)
        echo "error: development build carries a live Clerk key (${VITE_CLERK_PUBLISHABLE_KEY:0:8}…)." >&2
        echo "       Development sessions would act on production identities." >&2
        exit 1
        ;;
    esac
    ;;
esac

rl_banner "Deploying the SPA"
echo "  bucket:       $BUCKET"
echo "  distribution: $DISTRIBUTION_ID"
echo "  API origin:   $VITE_API_BASE_URL"
echo "  Clerk key:    ${VITE_CLERK_PUBLISHABLE_KEY:0:12}…"
echo

# ---- Build ------------------------------------------------------------------
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> Building web (VITE_API_BASE_URL=$VITE_API_BASE_URL)…"
  [ "${SKIP_INSTALL:-0}" = "1" ] || npm ci --prefix "$REPO_ROOT" >/dev/null
  # Start from an empty dist/. Vite empties it too, but a stale or duplicated
  # file left behind by an editor/sync tool would otherwise be synced to S3 and
  # served from the live origin.
  rm -rf "$DIST"
  npm run build --workspace @rooferslabs/shared --prefix "$REPO_ROOT"
  npm run build --workspace @rooferslabs/web --prefix "$REPO_ROOT"
fi

test -f "$DIST/index.html" || { echo "error: build produced no dist/index.html" >&2; exit 1; }

# The built bundle must contain the origin we asked for. Catches an env var that
# was set but not exported, and a cached dist/ from the other environment being
# republished under SKIP_BUILD=1.
if ! grep -rqF "$VITE_API_BASE_URL" "$DIST/assets" 2>/dev/null; then
  echo "error: the built bundle does not contain $VITE_API_BASE_URL." >&2
  echo "       dist/ may be stale — re-run without SKIP_BUILD." >&2
  exit 1
fi

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
# Defaults to the CloudFront domain rather than the public hostname: it is the
# origin this script actually just wrote to, and it is reachable before the
# Cloudflare record for a new environment exists.
VERIFY_URL="${WEB_VERIFY_URL:-}"
if [ -z "$VERIFY_URL" ]; then
  CF_DOMAIN=$(tf_out web_cloudfront_domain)
  [ -n "$CF_DOMAIN" ] && VERIFY_URL="https://$CF_DOMAIN"
fi

STATUS="not verified"
if [ -n "$VERIFY_URL" ]; then
  echo "==> Verifying $VERIFY_URL/ …"
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$VERIFY_URL/")
  if [ "$STATUS" != "200" ]; then
    echo "error: verification GET returned HTTP $STATUS (expected 200)." >&2
    exit 1
  fi
else
  # The upload and invalidation already succeeded; failing the deploy because
  # nobody told the script what to GET would be a worse outcome than saying so.
  echo "warning: no WEB_VERIFY_URL and no Terraform output — skipping verification." >&2
fi

# ---- Admin hostname (production only, and only once it exists) ---------------
# The same bucket and distribution serve the admin portal, so there is nothing
# extra to upload — but if the hostname is live, a deploy that broke its edge
# redirect should fail here rather than be discovered by a person.
#
# Development has no admin_url output, so this is skipped there entirely.
ADMIN_URL="${WEB_ADMIN_VERIFY_URL:-$(tf_out admin_url)}"
if [ -n "${ADMIN_URL:-}" ] && curl -s -o /dev/null --max-time 5 "$ADMIN_URL/" 2>/dev/null; then
  echo "==> Verifying $ADMIN_URL/ redirects to the portal…"
  ADMIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$ADMIN_URL/")
  ADMIN_TARGET=$(curl -s -o /dev/null -w '%{redirect_url}' "$ADMIN_URL/")
  case "$ADMIN_CODE" in
    301 | 302)
      case "$ADMIN_TARGET" in
        */admin) echo "    $ADMIN_CODE → $ADMIN_TARGET" ;;
        *)
          echo "error: $ADMIN_URL/ redirected to '$ADMIN_TARGET', expected /admin." >&2
          exit 1
          ;;
      esac
      ;;
    *)
      echo "error: $ADMIN_URL/ returned HTTP $ADMIN_CODE; expected a 302 to /admin." >&2
      echo "       The CloudFront viewer-request function may be missing or unpublished." >&2
      exit 1
      ;;
  esac
  # The portal itself must still be served by the SPA fallback.
  ADMIN_APP=$(curl -s -o /dev/null -w '%{http_code}' "$ADMIN_URL/admin")
  [ "$ADMIN_APP" = "200" ] || { echo "error: $ADMIN_URL/admin returned HTTP $ADMIN_APP." >&2; exit 1; }
  echo "    $ADMIN_URL/admin → $ADMIN_APP"
fi

echo "✅ Deployed the $ENVIRONMENT frontend to s3://$BUCKET via CloudFront $DISTRIBUTION_ID ($STATUS)."
