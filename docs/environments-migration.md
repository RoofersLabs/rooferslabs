# Migration, rollback, and verification

Runbook for applying the two-environment split. **Nothing in this document has
been applied.** Every step is ordered so that the risky ones come last and each
has a rollback that does not depend on the next one succeeding.

Read `docs/environments.md` first for the target architecture.

---

## What the production plan actually does

Captured at `docs/plans/production-refactor.plan.txt`:

```
Plan: 3 to add, 2 to change, 1 to destroy

  + terraform_data.clerk_instance_check       plan-time guard — no AWS resource
  + terraform_data.paddle_environment_check   plan-time guard — no AWS resource
  ~ module.api_service.aws_ecs_task_definition  adds APP_ENV=production (new revision)
  ~ module.api_service.aws_ecs_service          points at the new revision (rolling)
  ~ module.github_oidc.aws_iam_role.deploy      trust narrowed: main+develop → main
  - (the superseded task definition revision)
```

**No database, cache, bucket, distribution, certificate, load balancer, or
security group is created, replaced, or destroyed.** The refactor that moved
~60 resources into `modules/platform` is a pure state-address change, carried by
`moved` blocks in `envs/production/main.tf`.

### Two production landmines this surfaced

Both predate the refactor and are fixed in `terraform.tfvars`:

1. **`admin.rooferslabs.com` would have been taken offline.** The live ACM
   certificate carries it as a SAN and the distribution serves it as an alias,
   but `request_admin_certificate` and `enable_admin_alias` both defaulted to
   `false` — so any `terraform apply` from this repo would have replaced the
   certificate and destroyed the admin edge function. Verified against live AWS
   on 2026-07-30 and persisted into tfvars.

2. **`develop` deployed to production.** Both deploy workflows triggered on
   `[main, develop]` with repo-level variables, and the OIDC role trusted both
   branches. A push to `develop` touching `apps/web/**` shipped to
   rooferslabs.com. Fixed at both layers.

---

## Migration

### Phase 0 — verify the refactor is a no-op (no AWS changes)

```bash
cd infra/terraform/envs/production
terraform plan
```

**Gate:** the plan must match the summary above — 3 add, 2 change, 1 destroy,
with every other resource reported as `has moved to`. If anything shows
`must be replaced` for a database, certificate, security group, or distribution,
**stop**: a `moved` block is missing.

*Rollback:* none needed — nothing has been applied.

### Phase 1 — remote state

Terraform state currently lives on one laptop, gitignored, containing every
credential in plaintext. Losing it means production can no longer be managed by
Terraform at all.

```bash
cp infra/terraform/envs/production/terraform.tfstate ~/tfstate-backup-$(date +%F).json

cd infra/terraform/bootstrap
terraform init && terraform apply          # creates the versioned state bucket
```

Then uncomment the `backend "s3"` block in `envs/production/providers.tf` and:

```bash
cd ../envs/production
terraform init -migrate-state
terraform plan                             # must still show the Phase 0 result
```

*Rollback:* re-comment the backend block, `terraform init -migrate-state` back
to local, or restore the backup copied above. The bucket is versioned, so a bad
state write is recoverable by object version.

### Phase 2 — apply production

```bash
cd infra/terraform/envs/production
terraform apply
```

This rolls one new ECS task definition (adding `APP_ENV=production`) and narrows
the deploy role's trust policy. ECS performs a rolling replacement; the ALB
keeps serving from the old task until the new one is healthy.

*Rollback:*
```bash
aws ecs update-service --cluster rooferslabs-production \
  --service rooferslabs-production-api \
  --task-definition rooferslabs-production-api:6 --force-new-deployment
```
Revision 6 is the pre-change definition. The IAM trust-policy change is reverted
by restoring `github_deploy_branches` and re-applying — but note that reverting
it re-opens the develop-deploys-to-production hole.

### Phase 3 — GitHub configuration

Create a `production` **Environment** (Settings → Environments) and move these
from repo-level variables into it:

`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `WEB_BUCKET`, `WEB_DISTRIBUTION_ID`,
`VITE_API_BASE_URL`, `ECS_CLUSTER`, `API_SERVICE`, `API_REPO`, and the secret
`VITE_CLERK_PUBLISHABLE_KEY`.

Add a deployment branch rule restricting the environment to `main`.

*Rollback:* repo-level variables still work if the environment is deleted; the
workflows read the same names either way.

### Phase 4 — development environment (purely additive)

```bash
cd infra/terraform/envs/development
cp terraform.tfvars.example terraform.tfvars
# fill in: developer_cidr_blocks, Clerk dev keys, dev OpenAI key, Paddle sandbox
terraform init && terraform apply
```

Then:

```bash
infra/scripts/dev-env.sh
docker compose -f docker/docker-compose.yml up -d redis
npm run prisma:migrate          # seeds the development schema
```

*Rollback:* `terraform destroy` in `envs/development`. Nothing in production
references it, so this is safe at any time and at any hour.

### Phase 5 — clear the known deviations (when credentials exist)

Set `allow_clerk_instance_mismatch = false`, supply `pk_live_`/`sk_live_`,
apply, and redeploy the web bundle. Then the same for Paddle live.

**Clerk is a user-directory cutover, not a config change.** The production
instance has no copy of the development instance's accounts — plan the user
migration before flipping it.

---

## Rollback summary

| Phase | Blast radius | Rollback | Data loss |
|---|---|---|---|
| 0 plan | none | n/a | none |
| 1 remote state | state only | re-migrate to local / restore backup | none |
| 2 apply prod | one rolling ECS deploy | pin task definition `:6` | none |
| 3 GitHub env | CI only | revert to repo variables | none |
| 4 dev env | none (new resources) | `terraform destroy` | dev only |
| 5 Clerk/Paddle live | authentication, billing | revert tfvars, re-apply, redeploy | user directory — plan first |

Phases 0–4 touch no customer data. Phase 5 is the only one that does.

---

## Verification checklist

### Isolation

- [ ] `terraform state list` in `envs/development` contains no ECS, ALB, CloudFront, or S3 website resource
- [ ] Development VPC CIDR is `10.10.0.0/16`, production `10.0.0.0/16`; no peering connection exists
- [ ] `aws rds describe-db-instances` shows two instances with different endpoints
- [ ] `aws secretsmanager list-secrets` shows `rooferslabs-production/*` and `rooferslabs-development/*` as distinct entries
- [ ] Development state key is `development/terraform.tfstate`, production `production/terraform.tfstate`
- [ ] `aws ec2 describe-nat-gateways` shows exactly one NAT (production's)

### Guardrails — each must FAIL

- [ ] Production plan with `allow_clerk_instance_mismatch = false` and `pk_test_` → plan error
- [ ] Production plan with `allow_paddle_environment_mismatch = false` and sandbox → plan error
- [ ] Development plan with a `pk_live_` key → plan error
- [ ] API with `APP_ENV=production` and a development `DATABASE_URL` → refuses to boot
- [ ] API with `APP_ENV=development` and a production `DATABASE_URL` → boots with a loud warning
- [ ] `deploy-web.sh` with a `pk_test_` key and no `ALLOW_CLERK_DEV_KEY` → exits non-zero
- [ ] `dev-env.sh` pointed at production secret ARNs → refuses to write

Covered by `apps/api/src/config/environment-guard.spec.ts` (18 tests, passing).

### Deployment

- [ ] Push to `develop` → CI runs, **no deploy workflow triggers**
- [ ] Manual `workflow_dispatch` of a deploy workflow from `develop` → skipped by the `if:` guard
- [ ] Even if forced, AWS rejects the role assumption (trust policy names `main` only)
- [ ] Push to `main` touching `apps/web/**` → deploys production
- [ ] `aws iam get-role --role-name rooferslabs-production-deploy` trust policy contains `refs/heads/main` and **not** `refs/heads/develop`

### Application

- [ ] `curl -sI https://rooferslabs.com` returns the CSP including `https://cdn.paddle.com`
- [ ] Production ECS task definition contains `APP_ENV=production`
- [ ] Production boot logs show `[env] APP_ENV=production` with no cross-environment warning
- [ ] Generated `sw.js` contains `rooferslabs-production-v<version>` and **no** `NavigationRoute`
- [ ] Local `sw.js` (if built) contains `rooferslabs-development-v<version>`
- [ ] `infra/scripts/dev-env.sh --check` passes
- [ ] Local end-to-end: sign in via Clerk development, create a company, verify the row lands in the development database and **not** production

### Service worker

The previous build served every navigation from the precache, replaying the
security headers cached with it — which is why the corrected CSP never reached
real browsers. After deploying the new bundle, existing visitors need one
navigation to pick up the new service worker.

- [ ] DevTools → Application → Cache Storage shows buckets prefixed `rooferslabs-production-v…`
- [ ] Old unprefixed `workbox-precache-*` buckets are gone after one reload
- [ ] Paddle checkout opens in a real browser, not just under `curl`
