# shellcheck shell=bash
# =============================================================================
# require_main_branch — refuse to touch production from anywhere but `main`
# =============================================================================
# Sourced by every script that mutates production. One copy rather than five,
# because five copies of a safety check drift and the drifted one is the one
# that lets a bad deploy through.
#
#   source "$(dirname "$0")/lib/require-main-branch.sh"
#   require_main_branch "deploy the API to ECS"
#
# This is the last of three independent layers, and the only one that covers a
# deploy run by hand from a laptop:
#
#   1. GitHub Actions   `on.push.branches: [main]` + `if: github.ref == …`
#   2. AWS IAM          the OIDC trust policy names refs/heads/main only
#   3. this file        local runs, where neither of the above applies
#
# Layer 3 exists because infra/scripts/*.sh are documented as runnable directly
# and are the source of truth for how a deploy happens — the workflows are
# wrappers around them. A founder on `develop` running deploy-web.sh by hand is
# not a hypothetical path; it is the normal one.
#
# Determining the branch is not simply `git branch`. GitHub Actions checks out a
# detached HEAD, so `git rev-parse --abbrev-ref HEAD` returns the literal string
# "HEAD" there and a naive check would fail every real CI deploy. GITHUB_REF_NAME
# is the reliable answer under Actions and is consulted first.

# Resolve the branch this script is running against, or the empty string when
# it cannot be determined.
_current_branch() {
  # Under GitHub Actions the checkout is detached; the ref name is in the
  # environment. Only trust it for a branch push — a tag or pull_request ref
  # must never be mistaken for `main`.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    if [ "${GITHUB_REF_TYPE:-}" = "branch" ]; then
      printf '%s' "${GITHUB_REF_NAME:-}"
    fi
    return
  fi

  local branch
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || return
  # A local detached HEAD (mid-rebase, or a checked-out tag) is genuinely
  # ambiguous. Report nothing and let the caller refuse.
  [ "$branch" = "HEAD" ] && return
  printf '%s' "$branch"
}

# require_main_branch <description of what is about to happen>
require_main_branch() {
  local action="${1:-modify production}"
  local branch
  branch=$(_current_branch)

  if [ "$branch" = "main" ]; then
    return 0
  fi

  # Deliberate escape hatch. Loud, environment-variable-only, and never written
  # into a file — an incident should be able to route around this, but only by
  # someone who has read this message and typed the override on purpose.
  if [ "${ALLOW_DEPLOY_FROM_BRANCH:-0}" = "1" ]; then
    echo "WARNING: ALLOW_DEPLOY_FROM_BRANCH=1 — proceeding to $action from '${branch:-unknown}'." >&2
    echo "         Production will be updated with code that is not on main." >&2
    return 0
  fi

  cat >&2 <<EOF

error: refusing to $action from branch '${branch:-<could not determine>}'.

Production is updated from 'main' only. Development happens on localhost and is
never deployed — see docs/environments.md.

To ship this work:

    git push origin develop          # CI runs: typecheck, lint, tests, build
    # open a PR: develop -> main, merge it
    # pushing to main deploys production automatically

Note that even with this check bypassed, a GitHub Actions run on any branch
other than main cannot obtain AWS credentials: the OIDC role's trust policy
names refs/heads/main and nothing else.

If this is an incident and you must deploy from '${branch:-this branch}' anyway:

    ALLOW_DEPLOY_FROM_BRANCH=1 $0 $*

EOF
  exit 1
}
