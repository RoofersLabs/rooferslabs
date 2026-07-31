#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — environment resolution, shared by every deploy script
# =============================================================================
# Sourced, never executed. It answers one question — which environment is this
# command for? — in one place, so `deploy.sh`, `deploy-web.sh` and `db.sh`
# cannot disagree about it.
#
# The environment is resolved in this order:
#   1. the first argument, if it names one   (production | development)
#   2. $ENVIRONMENT
#   3. the current git branch                (main → production,
#                                             develop → development)
# and nothing else. There is deliberately no default: a script that guesses
# "production" when it cannot tell is the failure this whole split exists to
# prevent.
#
# Every value below can still be overridden by an environment variable, so CI
# runs with no Terraform state present at all (see .github/workflows).

# ---- Environment ↔ branch ↔ state directory ---------------------------------

rl_branch_for_environment() {
  case "$1" in
    production) echo "main" ;;
    development) echo "develop" ;;
  esac
}

rl_current_branch() {
  local branch
  branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  # A CI checkout is a detached HEAD, which would answer "HEAD" and quietly
  # disable the branch guard on exactly the runs it matters most for. GitHub
  # still names the ref it is building.
  if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
    branch="${GITHUB_REF_NAME:-}"
  fi
  echo "$branch"
}

# Normalizes the common short forms so `deploy.sh dev` does not fail on a
# technicality, but never invents an answer from nothing.
rl_normalize_environment() {
  case "${1:-}" in
    production | prod) echo "production" ;;
    development | dev) echo "development" ;;
    *) echo "" ;;
  esac
}

# Sets: ENVIRONMENT, TF_DIR. Call with "$@" from the script's argument list;
# it consumes the environment argument if there is one.
rl_resolve_environment() {
  local from_arg from_env from_branch
  from_arg=$(rl_normalize_environment "${1:-}")
  from_env=$(rl_normalize_environment "${ENVIRONMENT:-}")

  case "$(rl_current_branch)" in
    main) from_branch="production" ;;
    develop) from_branch="development" ;;
    *) from_branch="" ;;
  esac

  ENVIRONMENT="${from_arg:-${from_env:-$from_branch}}"

  if [ -z "$ENVIRONMENT" ]; then
    cat >&2 <<EOF
error: could not tell which environment this is for.

  Say so explicitly:      $(basename "$0") production
                          $(basename "$0") development
  or set ENVIRONMENT=…, or run from the main / develop branch.

Nothing is assumed here on purpose — guessing would eventually guess
"production" on a day you meant otherwise.
EOF
    exit 2
  fi

  TF_DIR="$REPO_ROOT/infra/terraform/envs/$ENVIRONMENT"
  if [ ! -d "$TF_DIR" ]; then
    echo "error: no Terraform root at $TF_DIR." >&2
    exit 1
  fi

  export ENVIRONMENT TF_DIR
}

# ---- Branch guard ------------------------------------------------------------
# Terraform's OIDC trust policies already make this unbypassable in CI: the
# production role trusts main alone, the development role develop alone. This is
# the same rule applied to a laptop, where the credentials are a person's own
# and no trust policy is in the way.

rl_guard_branch() {
  local expected actual
  expected=$(rl_branch_for_environment "$ENVIRONMENT")
  actual=$(rl_current_branch)

  [ -n "$expected" ] && [ -n "$actual" ] || return 0
  [ "$actual" != "$expected" ] || return 0

  if [ "${ALLOW_BRANCH_MISMATCH:-0}" = "1" ]; then
    echo "warning: deploying $ENVIRONMENT from '$actual' (expected '$expected') — ALLOW_BRANCH_MISMATCH=1." >&2
    return 0
  fi

  # Development is where half-finished branches are supposed to be tried, so a
  # mismatch there is a note. Production is not, so it is a stop.
  if [ "$ENVIRONMENT" = "development" ]; then
    echo "note: deploying development from '$actual' rather than '$expected'." >&2
    return 0
  fi

  cat >&2 <<EOF
error: refusing to deploy $ENVIRONMENT from branch '$actual'.

  Production ships from '$expected'. If this is a deliberate hotfix from
  another branch, re-run with ALLOW_BRANCH_MISMATCH=1.
EOF
  exit 1
}

# ---- Terraform output reader -------------------------------------------------
# Terraform is optional — a missing binary or absent state must never abort a
# script before the environment-variable overrides have had their say.

tf_out() {
  terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || true
}

tf_out_json() {
  terraform -chdir="$TF_DIR" output -json "$1" 2>/dev/null || true
}

# ---- Reporting ---------------------------------------------------------------

rl_banner() {
  echo "════════════════════════════════════════════════════════════════"
  echo " ${1}"
  echo " environment: ${ENVIRONMENT}   branch: $(rl_current_branch)"
  echo "════════════════════════════════════════════════════════════════"
}

# Fails with the same message shape everywhere rather than each script inventing
# its own way to say "I could not work out where to deploy".
rl_require() {
  local missing=()
  local var
  for var in "$@"; do
    [ -n "${!var:-}" ] || missing+=("$var")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "error: could not resolve ${missing[*]} for the $ENVIRONMENT environment." >&2
    echo "       Run 'terraform -chdir=$TF_DIR apply' first, or set ${missing[*]} in the environment." >&2
    exit 1
  fi
}
