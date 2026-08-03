# Environments

Two environments, two branches, two databases, and nothing shared that holds
data.

|                        | Production                                      | Development                        |
| ---------------------- | ----------------------------------------------- | ---------------------------------- |
| Frontend               | `rooferslabs.com`, `www`, `app.rooferslabs.com` | `dev.rooferslabs.com`              |
| API                    | `api.rooferslabs.com`                           | `api.dev.rooferslabs.com`          |
| Admin portal           | `admin.rooferslabs.com`                         | —                                  |
| Deploys from           | `main`                                          | `develop`                          |
| Terraform root         | `infra/terraform/envs/production`               | `infra/terraform/envs/development` |
| Stack name             | `rooferslabs-production`                        | `rooferslabs-development`          |
| `NODE_ENV` / `APP_ENV` | `production` / `production`                     | `development` / `development`      |
| Clerk                  | production instance                             | development instance               |
| PayPal                 | live (after cutover)                            | sandbox, enforced                  |

## What is isolated, and what is not

Isolated — one per environment, with no path between them:

- PostgreSQL (RDS instance), Redis (ElastiCache), Secrets Manager entries
- ECS cluster, service, task definition, ECR repository
- S3 buckets (recordings, uploads, SPA), CloudFront distribution, SQS queues
- IAM execution/task roles, CI deploy role, CloudWatch log groups and alarms
- ALB target group

Shared — idle capacity that carries no state:

- The **VPC** and its NAT gateway
- The **ALB**. Development gets its own hostname on it through a host-header
  rule and its own SNI certificate (`modules/alb-host`), routed to its own
  target group.

Sharing those two saves roughly $50/month over a full duplicate. Nothing about
them lets one environment reach the other's data: the databases and caches
whitelist their own environment's security group only, and the two IAM roles are
scoped to their own environment's ARNs.

## Why `APP_ENV` is not `NODE_ENV`

`NODE_ENV` says how Node should behave — verbose errors, pretty logs, Swagger's
relaxed CSP. `APP_ENV` says whose data this process may touch.

The development environment runs `NODE_ENV=development` because the diagnostics
are the point, while still being a real deployment serving a real database. If
the two were one variable, choosing readable logs would also switch off the
configuration checks that keep a half-configured API from booting. So:

- `APP_ENV` present → this is a deployment; validate the configuration in full
  (`apps/api/src/config/env.validation.ts`).
- `APP_ENV` names the tier → refuse to boot if `DATABASE_URL`, `REDIS_URL`, an
  S3 bucket or the SQS queue is named for the _other_ environment
  (`apps/api/src/config/environment-guard.ts`).

Every AWS resource carries its environment in its name, which is what lets that
check be exact rather than a heuristic. A production task handed the development
connection string dies at boot with the variable named in the message.

## Four layers of separation

1. **IAM.** The production deploy role trusts `main` alone; development's trusts
   `develop` alone. A workflow run on the wrong branch cannot assume the role at
   all — this is the layer that is not bypassable by editing a file.
2. **Terraform.** Two roots, two state files, no shared resource that holds
   data. Preconditions refuse a live Clerk key or a live PayPal estate in
   development.
3. **Deploy scripts.** `infra/scripts/env.sh` resolves the environment from the
   argument, `$ENVIRONMENT`, or the branch — never a default. Production refuses
   to ship from a branch other than `main`. `deploy-web.sh` refuses to publish a
   bundle carrying the other environment's API origin.
4. **Runtime.** The environment guard above.

## Deploying

```bash
infra/scripts/deploy.sh development       # API  → api.dev.rooferslabs.com
infra/scripts/deploy-web.sh development   # SPA  → dev.rooferslabs.com

infra/scripts/deploy.sh production        # API  → api.rooferslabs.com
infra/scripts/deploy-web.sh production    # SPA  → rooferslabs.com
```

Or push: `develop` deploys development, `main` deploys production. The workflows
are wrappers around exactly these scripts and can be disabled without blocking a
deploy.

## Database

Neither database is reachable from a laptop — both are in private subnets. Prisma
work runs as a one-off ECS task inside the VPC, using that environment's own
image and secret:

```bash
infra/scripts/db.sh development status
infra/scripts/db.sh production  status
infra/scripts/db.sh development deploy    # apply pending migrations by hand
```

`deploy` is rarely needed: the container runs `prisma migrate deploy` on every
start (`docker/api-entrypoint.sh`), so shipping the API applies the migrations.

Migrations are **written by hand** — see the note in
`prisma/migrations/20260729120000_provider_agnostic_billing/migration.sql` for
why `prisma migrate diff` is not trusted here — and applied with `db.sh`.

`prisma migrate dev` must never be pointed at a deployed database: it will offer
to reset it. The deployed path is `migrate deploy` and nothing else — which is
why `db.sh` takes an environment rather than a connection string.

PayPal provisioning works the same way and for the same reason:

```bash
infra/scripts/billing.sh development setup   # npm run billing:paypal:setup
```

## Bringing up the development environment

Certificates are two-phase because ACM validation records live in Cloudflare,
which Terraform does not manage here.

```bash
cd infra/terraform/envs/development
cp terraform.tfvars.example terraform.tfvars   # fill in DEVELOPMENT credentials
terraform init
terraform apply                                 # phase 1: no hostnames attached
terraform output acm_validation_records         # add these in Cloudflare (DNS-only)
terraform output web_certificate_validation_records
# wait for both certificates to report ISSUED, then:
terraform apply -var enable_https=true -var enable_web_custom_domain=true
```

Nothing is attached to the shared load balancer until `enable_https=true`, so
phase 1 cannot affect production.

Then deploy the code, and add the two public DNS records below.

## Cloudflare DNS

Terraform manages no DNS. `terraform output cloudflare_dns_records` prints the
records for either environment; the development ones are:

| Type  | Name      | Content                                 | Proxy   |
| ----- | --------- | --------------------------------------- | ------- |
| CNAME | `dev`     | _(development)_ `web_cloudfront_domain` | Proxied |
| CNAME | `api.dev` | _(shared ALB)_ `alb_dns_name`           | Proxied |

Plus, temporarily, the ACM validation CNAMEs from the two outputs above — those
must be **DNS-only (grey cloud)** or validation never completes. They can be
deleted once both certificates report ISSUED.

Production's existing records are unchanged. Adding `app.rooferslabs.com` is one
more CNAME to the same CloudFront domain as the apex; run
`infra/scripts/enable-app-domain.sh`, which stages the certificate replacement
and prints the records to add.

## Credentials

No production secret belongs in development, and no development secret in
production. Terraform enforces what it can:

- `envs/development` refuses to plan with a `pk_live_`/`sk_live_` Clerk key, or
  with `paypal_environment = "live"`.
- `envs/production` refuses to plan with `develop` in its deploy branches.

The rest is discipline: use a separate OpenAI key and a Twilio subaccount for
development, and generate a separate VAPID pair (push subscriptions are keyed to
it).

## Outstanding production cutovers

Two things about production are still development-grade, both tracked in
`infra/terraform/envs/production/terraform.tfvars`:

1. `rooferslabs.com` authenticates against the Clerk **development** instance.
   Supply `pk_live_`/`sk_live_` and apply.
2. The payment wall is **down**: no PayPal account is configured yet, so every
   tenant reaches the product without paying. Supply live credentials and plan
   IDs, set `paypal_environment = "live"`, set `payments_enabled = true`, and
   apply.

Neither is blocked by the environment split; both are a `terraform apply` away.
