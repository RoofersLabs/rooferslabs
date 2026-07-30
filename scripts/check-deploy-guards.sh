#!/usr/bin/env bash
# =============================================================================
# check-deploy-guards.sh — assert that only `main` can reach production
# =============================================================================
# Runs in CI on every branch, and locally with no arguments.
#
# The branch protections added in this change are spread across workflow
# triggers, job-level `if:` guards, GitHub Environments, an IAM trust policy,
# and a shell guard. Every one of them is a line someone can delete while
# fixing something unrelated, and none of them fails loudly when removed —
# a missing guard looks exactly like a working deploy right up until the wrong
# branch ships.
#
# So the guards are themselves tested. This script fails the build if any
# production deployment path becomes reachable from a branch other than main.
#
# Deliberately grep-based rather than YAML-parsed: no PyYAML on the runner, and
# the checks are about the literal text a reviewer would look for anyway.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

fail=0
note() { printf '  %s\n' "$1"; }
bad() { printf '  FAIL: %s\n' "$1" >&2; fail=1; }

# Everything between `on:` and the first following top-level key. Comments are
# stripped so prose mentioning develop cannot trip the branch checks.
trigger_block() {
  awk '/^on:/{f=1;next} /^[a-z_-]+:/{f=0} f' "$1" | sed 's/#.*//'
}

echo "==> Deployment workflows must trigger on main only"
for wf in .github/workflows/deploy-*.yml; do
  [ -e "$wf" ] || continue
  name=$(basename "$wf")
  block=$(trigger_block "$wf")

  if grep -qE '(^|[^a-z-])develop([^a-z-]|$)' <<<"$block"; then
    bad "$name triggers on develop"
  else
    note "$name: no develop trigger"
  fi

  if grep -qE 'branches:\s*\[\s*main\s*\]|^\s*-\s*main\s*$' <<<"$block"; then
    note "$name: branches restricted to main"
  else
    bad "$name does not restrict push triggers to [main]"
  fi

  # workflow_dispatch ignores on.push.branches entirely, so a manual run from
  # any branch would otherwise build that branch and ship it to production.
  if grep -q 'workflow_dispatch' <<<"$block"; then
    if grep -qE "if:.*github\.ref\s*==\s*'refs/heads/main'" "$wf"; then
      note "$name: workflow_dispatch pinned by an if: ref guard"
    else
      bad "$name allows workflow_dispatch without an 'if: github.ref == refs/heads/main' guard"
    fi
  fi

  # Scopes production credentials to the environment, so a run on another ref
  # cannot read them even if it somehow starts.
  if grep -qE '^\s*environment:\s*production\s*$' "$wf"; then
    note "$name: scoped to the production GitHub Environment"
  else
    bad "$name is not scoped to the production environment"
  fi
done

echo "==> CI must not be able to obtain AWS credentials"
# Without id-token: write, no job in ci.yml can complete an OIDC exchange —
# whatever else it is edited to attempt.
if grep -qE '^\s*id-token:\s*write' .github/workflows/ci.yml; then
  bad "ci.yml grants id-token: write — it could assume an AWS role"
else
  note "ci.yml: no id-token permission"
fi

if grep -qE 'configure-aws-credentials|aws-actions/' .github/workflows/ci.yml; then
  bad "ci.yml configures AWS credentials"
else
  note "ci.yml: no AWS credential configuration"
fi

echo "==> CI must not reach Terraform state"
# `validate` needs no backend; `plan`/`apply` do. -backend=false is what keeps
# the production state file unreachable from a branch build.
if grep -qE 'terraform.*(plan|apply|destroy)' .github/workflows/ci.yml; then
  bad "ci.yml runs terraform plan/apply/destroy"
else
  note "ci.yml: validate only, no plan/apply/destroy"
fi

if grep -q 'init -backend=false' .github/workflows/ci.yml; then
  note "ci.yml: terraform init uses -backend=false"
else
  bad "ci.yml terraform init does not pass -backend=false"
fi

echo "==> Production scripts must require the main branch"
for s in deploy.sh deploy-web.sh enable-admin-domain.sh; do
  if grep -q 'require_main_branch' "infra/scripts/$s"; then
    note "$s: calls require_main_branch"
  else
    bad "infra/scripts/$s does not call require_main_branch"
  fi
done

echo "==> Terraform must trust exactly one branch per environment"
# github_deploy_branches has a length==1 validation in modules/platform; this
# checks the production root still passes main rather than something wider.
if grep -qE 'github_deploy_branches\s*=\s*\["main"\]' infra/terraform/envs/production/main.tf; then
  note "envs/production: deploy role trusts [main]"
else
  bad "envs/production does not pin github_deploy_branches to [\"main\"]"
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "Deployment guard check FAILED — a path to production from a non-main branch exists." >&2
  exit 1
fi
echo "All deployment guards present: production is reachable from main only."
