#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — run the API and web app together
# =============================================================================
#   bun run dev
#
# Runs a preflight, starts both dev servers, prints the URLs, and shuts both
# down cleanly on Ctrl-C.
#
# Plain bash rather than `concurrently`: two background jobs and a trap is the
# whole requirement, and adding a dependency to the critical path of "can a new
# clone start" is a poor trade.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN=$'\033[32m'; RED=$'\033[31m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

if command -v bun >/dev/null 2>&1; then PKG="bun"; else PKG="npm"; fi

# ---- Preflight -----------------------------------------------------------------
# Cheap, and it turns "the API exited three seconds after starting" into a
# sentence naming the missing piece. --quiet prints nothing when all is well, so
# a normal start stays quiet.
if ! node scripts/check-dev-env.mjs --quiet; then
  printf '\n%serror:%s the development environment is not ready.\n\n' "$RED" "$RESET" >&2
  printf 'Run %sbun run setup%s to fix it.\n\n' "$BOLD" "$RESET" >&2
  exit 1
fi

# ---- Start ----------------------------------------------------------------------

API_PID=""
WEB_PID=""

# Kill the whole process group of each server, not just the launcher: `npm run
# dev` spawns nest/vite as children, and killing only the parent leaves them
# holding ports 4000 and 5173 — so the next `bun run dev` fails with EADDRINUSE.
# Guards against running twice. Background jobs started with `&` inherit this
# trap, so when cleanup signals their process group they re-enter it — harmless
# (the kills are idempotent) but it prints the shutdown notice once per job.
CLEANED=0

cleanup() {
  [ "$CLEANED" = "1" ] && return 0
  CLEANED=1
  trap - INT TERM
  printf '\n%sshutting down…%s\n' "$DIM" "$RESET"
  for pid in "$API_PID" "$WEB_PID"; do
    [ -n "$pid" ] && kill -- "-$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

# INT and TERM only — deliberately NOT EXIT.
#
# A background job started with `&` runs in a subshell that inherits this trap,
# so with EXIT in the list the FIRST server to finish booting would fire
# cleanup from inside its own subshell and kill its sibling. The result is both
# servers tearing each other down in a loop, seconds after a start that looked
# fine. Cleanup is instead invoked explicitly at the end of the script.
trap cleanup INT TERM

printf '\n%sStarting RoofersLabs%s\n' "$BOLD" "$RESET"
printf '  %sapi%s   http://localhost:4000\n' "$GREEN" "$RESET"
printf '  %sweb%s   http://localhost:5173\n' "$GREEN" "$RESET"
printf '  %sCtrl-C to stop both%s\n\n' "$DIM" "$RESET"

# `set -m` puts each in its own process group so the trap above can signal the
# whole tree.
# Each workspace's OWN dev script, invoked by directory.
#
# Not `$PKG run dev:api`: bun rewrites `npm run` inside package scripts to
# `bun run`, so the root `dev:api` alias (`npm run dev --workspace ...`)
# resolved `dev` against the ROOT package.json — which is this launcher. The
# result was dev.sh spawning dev.sh, a fork bomb that never bound a port.
# Running each workspace directory directly has no such ambiguity.
set -m
(cd "$ROOT/apps/api" && exec $PKG run dev) & API_PID=$!
(cd "$ROOT/apps/web" && exec $PKG run dev) & WEB_PID=$!
set +m

# Wait until EITHER server exits, then stop the other rather than leaving half a
# stack running and looking healthy.
#
# Polled with `kill -0` rather than `wait -n`, which does not exist in bash 3.2
# — the version macOS still ships as /bin/bash. `wait -n` fails there with
# "invalid option", the trap fires, and both servers are torn down immediately
# on a machine where everything is actually fine.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 1
done

printf '\n%sone of the dev servers exited — stopping the other.%s\n' "$RED" "$RESET" >&2
cleanup
exit 1
