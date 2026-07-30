# Environments

RoofersLabs runs **two environments**. They share no database, no cache, no
secret, no credential, and no Terraform state.

| | Production | Development |
|---|---|---|
| Purpose | Live customer traffic | Internal development |
| Runs on | AWS (ECS Fargate + CloudFront) | **localhost** |
| Web | `rooferslabs.com`, `www.rooferslabs.com` | `http://localhost:5173` |
| API | `api.rooferslabs.com` | `http://localhost:4000` |
| Deployed from | `main` only | never deployed |
| Database | RDS `rooferslabs-production` (private) | Postgres in Docker |
| Cache | ElastiCache `rooferslabs-production` | Redis in Docker |
| Clerk | production instance (`pk_live_`) | development instance (`pk_test_`) |
| Paddle | live | sandbox |
| Terraform | `envs/production` | `envs/development` |
| State key | `production/terraform.tfstate` | `development/terraform.tfstate` |

There is deliberately **no deployed development site**, and local development
touches **no AWS resource at all** — Postgres and Redis run in Docker. A clean
clone reaches a running app with `bun install && bun run setup && bun run dev`,
needing no AWS account, no Terraform, and no credentials beyond a Clerk
development key.

That is the cheapest thing that satisfies the actual requirement — a safe place
to work that cannot touch customers — and it removes an entire hosting stack
from the things that can break or cost money.

## Architecture

```
                         ┌──────────────── AWS account 462292557780 ─────────────────┐
                         │                                                            │
  PRODUCTION             │   VPC 10.0.0.0/16  (NAT, private subnets)                  │
  ──────────             │   ┌──────────────────────────────────────────────────┐     │
                         │   │  ALB ──► ECS Fargate (api)                        │     │
  rooferslabs.com ───────┼──►│           │            │                          │     │
  www.rooferslabs.com    │   │           ▼            ▼                          │     │
        │                │   │   RDS rooferslabs-  ElastiCache                   │     │
        ▼                │   │   production        rooferslabs-production        │     │
  CloudFront ──► S3      │   │   (private)         (private)                     │     │
  (own CSP, cache,       │   └──────────────────────────────────────────────────┘     │
   SW namespace)         │        ▲                                                    │
                         │        │ secrets: rooferslabs-production/{database,app}     │
  api.rooferslabs.com ───┼────────┘                                                    │
                         │                                                             │
  ═══════════════════════│═════════════ no shared resource ════════════════════════════│
                         │                                                             │
  DEVELOPMENT            │   VPC 10.10.0.0/16  (no NAT — nothing needs egress)         │
  ───────────            │   ┌──────────────────────────────────────────────────┐     │
                         │   │   RDS rooferslabs-development                     │     │
  localhost:5173 ────────┼──►│   public endpoint, SG = your /32, rds.force_ssl=1 │     │
  localhost:4000 ────────┼──►│                                                   │     │
        │                │   └──────────────────────────────────────────────────┘     │
        ▼                │        ▲                                                    │
  Redis in Docker        │        │ secrets: rooferslabs-development/{database,app}     │
  (localhost:6379)       │        │                                                    │
                         └────────┼────────────────────────────────────────────────────┘
                                  │
                          (not used by local development — see below)
```

The two VPCs are not peered. There is no route between them.

### Why development data stores are Docker

Both run locally, which makes a clean clone self-sufficient: nothing to apply,
no credentials to obtain, and no shared state for one developer to break for
everyone else.

ElastiCache could not have been used regardless — it has **no public endpoint
option**, being VPC-only by design, so reaching it from a laptop needs an SSM
bastion or a VPN. Postgres could have been a public-endpoint RDS instance, and
`envs/development` still provisions one, but requiring it made a clean clone
depend on an applied Terraform stack. It is now optional and unapplied.

**Running cost of development: $0.**

## Terraform layout

```
infra/terraform/
├── bootstrap/              S3 remote-state bucket (apply once, own local state)
├── modules/
│   ├── platform/           ONE COMPLETE ENVIRONMENT — composes everything below
│   ├── networking/  rds/  redis/  s3/  sqs/  secrets/  iam/
│   ├── alb/  ecs-service/  ecr/  frontend-cdn/  observability/  github-oidc/
└── envs/
    ├── production/         VPC + modules/platform          → production/terraform.tfstate
    └── development/        OPTIONAL shared dev DB — unapplied, unused by local dev
```

`envs/production` is a thin root: it creates the VPC and calls
`modules/platform`. Everything that should be true of any full environment lives
in the module, so a second full environment cannot drift from production by
being written out again by hand.

### Adding `devstage.rooferslabs.com` later

Already supported. It is a new root that calls the same module — no structural
change, no module edits:

```hcl
module "networking" {
  source = "../../modules/networking"
  name   = "rooferslabs-devstage"
  vpc_cidr = "10.20.0.0/16"
}

module "platform" {
  source = "../../modules/platform"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  environment            = "devstage"
  web_domain             = "devstage.rooferslabs.com"
  api_domain             = "api.devstage.rooferslabs.com"
  web_bucket_name        = "rooferslabs-devstage-web-${account_id}"
  ecr_namespace          = "rooferslabs-devstage"
  github_deploy_branches = ["devstage"]
  paddle_environment     = "sandbox"    # enforced by the module's guardrail
  # ...credentials
}
```

The pieces that made this possible are already in place:

- `modules/platform` takes `web_domain`/`api_domain` rather than deriving
  hostnames from an apex, so a subdomain environment is expressible.
- `frontend-cdn` takes `cert_primary_domain`, so a subordinate environment
  issues its own ACM certificate instead of racing production for the apex.
- The application reads `APP_ENV`/`VITE_APP_ENV` as a free-form tier, so a third
  value needs no code change.
- Service-worker caches are namespaced by tier and version already.

## Guardrails

Cross-environment mistakes are blocked at **three** layers, because each catches
what the others cannot.

**1. Terraform (plan time)** — `modules/platform` refuses to plan production
with Clerk `pk_test_`/`sk_test_` keys or `paddle_environment = "sandbox"`.
`envs/development` refuses `pk_live_`/`sk_live_` or a `pdl_live_` Paddle key.

**2. AWS IAM (deploy time)** — the production OIDC deploy role's trust policy
names `main` and nothing else. A workflow edit alone cannot deploy `develop` to
production; AWS refuses the role assumption.

**3. Application (boot time)** — `apps/api/src/config/environment-guard.ts`
classifies `DATABASE_URL`, `REDIS_URL`, Clerk keys, and Paddle config by tier and
compares them against `APP_ENV`:

- **production throws** and does not start. A live API on a development database
  serves customers empty data; not booting is strictly better.
- **development warns loudly** but starts. The usual cause is a half-finished
  `.env`, and blocking all local work over it helps nobody.

`APP_ENV` is deliberately separate from `NODE_ENV`. `NODE_ENV` selects a *build
mode* and is `production` in every deployed environment including a future
devstage; the *tier* is a different question. Anything unrecognised resolves to
`development`, so production authority is only ever granted by name.

### Known deviations (the launch checklist)

Two guardrails are currently acknowledged rather than satisfied, in
`envs/production/terraform.tfvars`:

| Flag | Why it is set | To clear |
|---|---|---|
| `allow_clerk_instance_mismatch = true` | rooferslabs.com authenticates live visitors against the Clerk **development** instance (`immortal-adder-67.clerk.accounts.dev`) | Supply `pk_live_`/`sk_live_`, set to `false` |
| `allow_paddle_environment_mismatch = true` | `payments_enabled = true` with `paddle_environment = "sandbox"` — the payment wall is enforced by Paddle **TEST** and settles no money | Supply live keys + live price IDs, set to `false` |

Both are real, live conditions that predate this refactor. They are written down
and enforced-once-cleared rather than silently tolerated.

## Local development

Local development runs **entirely on your machine** and touches no AWS
resource — Postgres and Redis in Docker, no Terraform, no credentials.

```bash
bun install && bun run setup && bun run dev
```

See **[docs/local-development.md](local-development.md)** for the full guide.

`envs/development` provisions an optional shared development database in AWS.
Nothing in the local workflow consumes it and it does not need to be applied.

### Migrations

Development and production have independent migration history.

- **Local**: `bun run db:migrate` against the Docker Postgres.
- **Production**: applied automatically when the API container starts
  (`docker/api-entrypoint.sh` runs `prisma migrate deploy`).
- **Production, by hand**: `infra/scripts/db.sh deploy` — a one-off ECS task
  inside the VPC. Requires typing `production` to confirm.

Write migrations by hand rather than with `migrate diff`, which turns column
renames into data-destroying DROP + ADD.

## Cost

| | Monthly |
|---|---|
| Production | unchanged |
| Development RDS `db.t4g.micro` + 20 GB gp3 | ~$15 |
| Development VPC (no NAT) | $0 |
| Development Redis (Docker) | $0 |
| **Added by this refactor** | **~$15** |
