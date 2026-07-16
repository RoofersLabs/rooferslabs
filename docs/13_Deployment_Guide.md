# Deployment Guide

**Document Status:** Active
**Scope:** r1 echo production deployment (AWS + Cloudflare)
**Prerequisite reading:** `10_AWS_Infrastructure.md`, `00_GStack_Architecture.md`

This is the operational runbook for deploying the RoofersLabs platform to
production: the frontend on **Vercel**, the backend as a Docker image on
**Amazon ECS/Fargate**, with Amazon RDS PostgreSQL, ElastiCache Redis, S3,
SQS, Secrets Manager, CloudWatch, and Cloudflare at the edge.

---

## 1. Topology

```text
Browser / PWA ──► Cloudflare (app.rooferslabs.com) ──► Vercel (static PWA)

Customer phone ─► Twilio ─┐
Browser / PWA ────────────┤► Cloudflare (api.rooferslabs.com)
                          ▼
                     AWS ALB ──► ECS Fargate: rooferslabs-api (NestJS, :4000)
                                      │
                  ┌───────────┬───────┴────┬───────────┬──────────────┐
                  ▼           ▼            ▼           ▼              ▼
             Amazon RDS     Redis      Amazon S3   Amazon SQS    CloudWatch
            (PostgreSQL) (ElastiCache) (recordings) (jobs+DLQ)      (logs)
```

Two DNS names:

| Host | Serves | Origin |
| ---- | ------ | ------ |
| `app.rooferslabs.com` | PWA (static) | Vercel |
| `api.rooferslabs.com` | REST API + Media Streams WebSocket | Cloudflare → ALB → api service |

---

## 2. Provision AWS with Terraform (one-time)

**The entire AWS environment is Infrastructure as Code** under
`infra/terraform/` — VPC, ALB (+ACM), ECR, ECS Fargate, RDS PostgreSQL,
ElastiCache Redis, S3, Secrets Manager, IAM, and CloudWatch. Do not create AWS
resources by hand; change Terraform and apply.

```bash
cd infra/terraform/envs/production
cp terraform.tfvars.example terraform.tfvars   # fill in domain + external keys
terraform init
terraform apply                                # phase 1: HTTP
terraform output acm_validation_records        # add CNAMEs in Cloudflare (DNS-only)
terraform apply -var 'enable_https=true'       # phase 2: HTTPS once the cert issues
```

The complete from-scratch walkthrough — including outputs for Cloudflare,
Twilio, and day-2 operations — is `infra/terraform/README.md`. The only
inputs you provide are your domain and external credentials (Clerk, OpenAI,
Twilio, VAPID); database passwords are generated and stored in Secrets
Manager automatically.

---

## 3. What Terraform provisions

For reference (all of this is created by `terraform apply`; see the modules
under `infra/terraform/modules/`):

1. **VPC** — 2 AZs, public subnets for the ALB/NAT, private subnets for
   ECS/RDS/Redis.
2. **RDS PostgreSQL 16** — encrypted gp3 storage with autoscaling, 7-day
   automated backups, deletion protection, generated master password (never
   leaves Secrets Manager), security group admitting only the API service.
3. **ElastiCache Redis 7** — single node by default (`replicas_per_node` for
   failover), same network rules. Backs both the application cache and
   fleet-wide API rate limiting.
4. **S3** — private `recordings` + `uploads` buckets (KMS encryption, all
   public access blocked).
5. **SQS** — `rooferslabs-production-jobs` queue (long polling, SSE) with a
   14-day dead-letter queue (redrive after 5 attempts). Provisioned and
   permitted so background consumers can ship in a later release without an
   infrastructure migration; the app processes jobs inline until then
   (`BACKGROUND_JOBS_INLINE=true`).
6. **Secrets Manager** — `rooferslabs-production/database` (generated
   DATABASE_URL) and `rooferslabs-production/app` (Clerk/OpenAI/Twilio/VAPID),
   mapped into the task definition via `valueFrom`.
7. **ECR** — `rooferslabs/api` with lifecycle policies (the frontend has no
   production image — it deploys to Vercel).
8. **ECS Fargate** — one cluster, the API service behind the ALB,
   WebSocket-friendly 300 s idle timeout, deployment circuit breaker with
   automatic rollback, ECS Exec enabled. Health check: `GET /v1/health/ready`.
9. **CloudWatch** — log group (`/rooferslabs-production/api`, 30-day
   retention) and alarms on ALB 5xx + API CPU (optional email via
   `alarm_email`).
10. **IAM** — execution role limited to pulling images, writing logs, and
    reading the two secrets; task role limited to the two S3 buckets and the
    SQS queues.

All production env values (`API_PUBLIC_URL`, `CORS_ORIGINS`,
`TWILIO_MEDIA_STREAM_URL`, model names, …) are derived from your domain inside
Terraform — nothing to assemble by hand.

---

## 4. Deploy / release

**Backend (API):**

```bash
infra/scripts/deploy.sh          # build, push, and roll the API service
```

The script reads every setting from Terraform outputs (ECR URL, cluster and
service names), builds a `linux/amd64` image tagged `latest` + git SHA, and
waits for the service to stabilize. The api entrypoint runs
`prisma migrate deploy` before the server starts (`MIGRATE_ON_START=true`).
Rolling deployments with the circuit breaker give zero-downtime releases and
automatic rollback on failed health checks; manual rollback = redeploy the
previous image tag.

**Frontend (Vercel):** production deploys ride pushes to the production
branch (`vercel --prod` for manual deploys). `/vercel.json` owns the monorepo
build, SPA rewrites, and cache/security headers; rollback = "Promote previous
deployment" in the Vercel dashboard.

Required Vercel project settings: import this repository, add the
`app.rooferslabs.com` domain, and set the environment variables
`VITE_CLERK_PUBLISHABLE_KEY` (pk_live) and
`VITE_API_BASE_URL=https://api.rooferslabs.com`.

---

## 5. Cloudflare configuration

1. Add the `rooferslabs.com` zone; point the domain's nameservers at Cloudflare.
2. DNS records:
   - `api` → CNAME → ALB DNS name (**Proxied** ☁️)
   - `app` → CNAME → `cname.vercel-dns.com` (**DNS only** recommended —
     Vercel terminates TLS and manages its own edge cache; if proxied, add a
     cache-bypass rule for `app.rooferslabs.com/sw.js` and
     `/manifest.webmanifest`)
   - ACM validation CNAMEs from `terraform output acm_validation_records`
     (**DNS only**)
   - Clerk production-instance CNAMEs (**DNS only**)
3. **SSL/TLS → Full (strict)** (the ALB has a valid ACM certificate).
4. **Network → WebSockets: ON** (required for Twilio Media Streams).
5. Edge Certificates → Always Use HTTPS: ON; minimum TLS 1.2.
6. Recommended rules:
   - Cache Rule: `api.rooferslabs.com/*` → bypass cache.
   - Rate-limiting rule on `api.rooferslabs.com/v1/*` as a coarse edge shield
     (the API also rate-limits per instance).
7. Do **not** enable Rocket Loader / auto-minify on the app host (breaks the
   service worker's precache hashes).

---

## 6. Twilio configuration

For each Twilio number assigned to a company (Console → Phone Numbers →
Manage → Active numbers → the number → **Voice Configuration**):

- **A call comes in:** Webhook → `https://api.rooferslabs.com/v1/telephony/incoming` → HTTP POST
- **Call status changes:** `https://api.rooferslabs.com/v1/telephony/status` → HTTP POST

Then assign the number to the tenant via the API:
`POST /v1/telephony/phone-numbers/assign` with `{ "phoneNumber": "+1…" }`
(authenticated as that company's owner), or seed it directly.

Customer-side call forwarding instructions live in the product
(Settings → Phone Setup) and in the README.

---

## 7. Clerk configuration (production instance)

1. Create a **production** Clerk instance; add `app.rooferslabs.com` as the
   application domain and complete Clerk's DNS records (CNAMEs in Cloudflare —
   set those records to **DNS only**, not proxied).
2. Enable Email + Password (and optionally Google) sign-in.
3. Put `sk_live_…` / `pk_live_…` in `terraform.tfvars` (Terraform writes them
   to Secrets Manager) and set `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…` in the
   Vercel project.
4. Allowed redirect origins: `https://app.rooferslabs.com`.

---

## 8. Post-deploy verification

```bash
curl -s https://api.rooferslabs.com/v1/health         | jq .data.status   # "ok"
curl -s https://api.rooferslabs.com/v1/health/ready   | jq .data          # database+cache true
open https://app.rooferslabs.com                       # landing renders, register works
```

Then run the full testing checklist in the README (§Testing checklist),
including one real forwarded phone call.

---

## 9. Rollback

1. `aws ecs update-service … --task-definition <previous revision>` for the
   affected service.
2. Database: migrations are additive by convention (docs/08 §26); if a
   migration must be reverted, restore the RDS snapshot taken automatically
   before the release window.
