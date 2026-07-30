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
| Database | RDS `rooferslabs-production` (private) | RDS `rooferslabs-development` (IP-locked) |
| Cache | ElastiCache `rooferslabs-production` | Redis in Docker |
| Clerk | production instance (`pk_live_`) | development instance (`pk_test_`) |
| Paddle | live | sandbox |
| Terraform | `envs/production` | `envs/development` |
| State key | `production/terraform.tfstate` | `development/terraform.tfstate` |

There is deliberately **no deployed development site**. Development is a laptop
talking to its own database. That is the cheapest thing that satisfies the
actual requirement — a safe place to work that cannot touch customers — and it
removes an entire hosting stack from the things that can break or cost money.

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
                          infra/scripts/dev-env.sh  ──►  .env + apps/web/.env.local
```

The two VPCs are not peered. There is no route between them.

### Why development Redis is Docker, not ElastiCache

ElastiCache has **no public endpoint option** — it is VPC-only by design, with
no setting to change that. Reaching it from a laptop requires an SSM bastion or
a VPN. Redis here holds cache, sessions, and queue state: nothing durable and
nothing worth a bastion to run and patch. Docker gives a genuinely separate
instance with separate credentials at zero cost, which is what the isolation
requirement is actually asking for.

RDS *does* have a public endpoint option, so the development database is real
AWS infrastructure — persistent, backed up, and shared across machines.

### Why the development VPC is free

No NAT gateway (`enable_nat_gateway = false`). A NAT exists to give private
subnets outbound internet; the development environment has no compute and its
database is publicly addressable, so nothing needs egress. Full network
isolation therefore costs nothing, which is why it is a separate VPC rather than
a corner of production's.

**Running cost of development: one `db.t4g.micro` + storage (~$15/month).**

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
    └── development/        VPC + RDS + secrets + IAM only  → development/terraform.tfstate
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

One-time setup:

```bash
cd infra/terraform/envs/development
cp terraform.tfvars.example terraform.tfvars   # fill in dev credentials
terraform init && terraform apply
```

Every day:

```bash
infra/scripts/dev-env.sh                                  # regenerate .env files
docker compose -f docker/docker-compose.yml up -d redis
npm run prisma:generate
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173
```

`dev-env.sh` reads the **development** Secrets Manager entries and writes `.env`
and `apps/web/.env.local`. Both files are generated — never hand-edit them; re-run
the script. It refuses to write a `pk_live_`, `sk_live_`, `pdl_live_`, or
production database URL to disk at all.

`dev-env.sh --check` verifies the local files are generated and free of
production credentials. `--print` shows what would be written, masked.

If the database stops responding, your public address probably changed:

```bash
curl -s https://checkip.amazonaws.com     # then update developer_cidr_blocks and re-apply
```

### Migrations

Development and production have independent migration history because they are
separate databases.

- **Development**: `npm run prisma:migrate` — reads the generated `.env`, so it
  targets the development database. This is where migrations are authored.
- **Production**: applied automatically on API start
  (`docker/api-entrypoint.sh` runs `prisma migrate deploy`). Shipping the API
  applies the migrations.
- **Production, by hand**: `infra/scripts/db.sh deploy` — runs a one-off ECS
  task inside the VPC. Now requires typing `production` to confirm.

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
