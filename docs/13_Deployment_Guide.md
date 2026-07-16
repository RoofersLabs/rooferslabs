# Deployment Guide

**Document Status:** Active
**Scope:** r1 echo production deployment (AWS + Cloudflare)
**Prerequisite reading:** `10_AWS_Infrastructure.md`, `00_GStack_Architecture.md`

This is the operational runbook for deploying the RoofersLabs platform to
production. It follows the frozen G-Stack architecture: Docker images on
Amazon ECS/Fargate, Amazon RDS PostgreSQL, Redis, S3, Secrets Manager,
CloudWatch, and Cloudflare at the edge.

---

## 1. Topology

```text
Customer phone ──► Twilio ──► Cloudflare (api.rooferslabs.com)
                                   │
Browser / PWA ──► Cloudflare ──────┤
  (app.rooferslabs.com)            ▼
                          AWS ALB ──► ECS Fargate
                                   ├── rooferslabs-api (NestJS, port 4000)
                                   └── rooferslabs-web (nginx, port 80)
                                        │
                     ┌─────────────┬────┴───────┬──────────────┐
                     ▼             ▼            ▼              ▼
                Amazon RDS      Redis        Amazon S3     CloudWatch
               (PostgreSQL) (ElastiCache) (recordings/logos)  (logs)
```

Two DNS names, both proxied through Cloudflare:

| Host | Serves | Origin |
| ---- | ------ | ------ |
| `app.rooferslabs.com` | PWA (static) | ALB → web service |
| `api.rooferslabs.com` | REST API + Media Streams WebSocket | ALB → api service |

---

## 2. Build & push images

```bash
AWS_ACCOUNT=<account-id>
REGION=us-east-1
ECR=$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR

# API
docker build -f docker/api.Dockerfile -t $ECR/rooferslabs-api:$(git rev-parse --short HEAD) .
docker push $ECR/rooferslabs-api:$(git rev-parse --short HEAD)

# Web (Vite inlines its env at build time)
docker build -f docker/web.Dockerfile \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  --build-arg VITE_API_BASE_URL=https://api.rooferslabs.com \
  -t $ECR/rooferslabs-web:$(git rev-parse --short HEAD) .
docker push $ECR/rooferslabs-web:$(git rev-parse --short HEAD)
```

---

## 3. AWS provisioning (one-time)

1. **VPC** — 2 AZs, public subnets for the ALB, private subnets for ECS/RDS/Redis.
2. **RDS PostgreSQL 16** — `db.t4g.small` to start, storage autoscaling,
   automated backups (7-day retention), private subnet, security group that
   only admits the ECS tasks.
3. **ElastiCache Redis 7** — `cache.t4g.micro` to start, same network rules.
4. **S3** — two private buckets: `rooferslabs-recordings-prod`,
   `rooferslabs-uploads-prod`. Block all public access; server-side encryption.
5. **SQS** — `rooferslabs-jobs-prod` standard queue + dead-letter queue
   (set `BACKGROUND_JOBS_INLINE=false` once workers consume it).
6. **Secrets Manager** — one secret `rooferslabs/prod/api` holding every value
   from `.env.example` (DATABASE_URL, REDIS_URL, CLERK_*, OPENAI_*, TWILIO_*,
   S3_*, …). The ECS task definition maps each key to an environment variable.
7. **ECR** — repositories `rooferslabs-api` and `rooferslabs-web`.
8. **ECS cluster** (Fargate) with two services behind one ALB:
   - `api` — task 0.5 vCPU / 1 GB, port 4000, health check
     `GET /v1/health` (200), desired count ≥ 2.
     **Target group must have stickiness disabled and support WebSockets**
     (ALB does by default; idle timeout ≥ 300 s for long calls).
   - `web` — task 0.25 vCPU / 512 MB, port 80, health check `GET /` (200).
   - ALB listener rules: host `api.rooferslabs.com` → api target group,
     host `app.rooferslabs.com` → web target group. HTTPS via ACM certificate
     for both hosts (or a `*.rooferslabs.com` cert).
9. **CloudWatch** — the `awslogs` driver on both task definitions
   (`/ecs/rooferslabs-api`, `/ecs/rooferslabs-web`); alarms on ALB 5xx rate,
   target health, and API p99 latency.
10. **IAM** — task role for the api service permitting only: the two S3
    buckets, the SQS queue, and reading the one secret.

Production env values that differ from local:

```
NODE_ENV=production
API_PUBLIC_URL=https://api.rooferslabs.com
WEB_PUBLIC_URL=https://app.rooferslabs.com
CORS_ORIGINS=https://app.rooferslabs.com
TWILIO_MEDIA_STREAM_URL=wss://api.rooferslabs.com/v1/telephony/media-stream
MIGRATE_ON_START=true          # single-writer migration on task start
LOG_LEVEL=info
```

---

## 4. Deploy / release

```bash
# Update the task definition image tag, then:
aws ecs update-service --cluster rooferslabs --service api --force-new-deployment
aws ecs update-service --cluster rooferslabs --service web --force-new-deployment
```

The api entrypoint runs `prisma migrate deploy` before the server starts
(`MIGRATE_ON_START=true`). Rolling deployments with a minimum healthy percent
of 100 give zero-downtime releases; rollback = redeploy the previous image tag.

---

## 5. Cloudflare configuration

1. Add the `rooferslabs.com` zone; point the domain's nameservers at Cloudflare.
2. DNS records (both **Proxied** ☁️):
   - `app` → CNAME → ALB DNS name
   - `api` → CNAME → ALB DNS name
3. **SSL/TLS → Full (strict)** (the ALB has a valid ACM certificate).
4. **Network → WebSockets: ON** (required for Twilio Media Streams).
5. Edge Certificates → Always Use HTTPS: ON; minimum TLS 1.2.
6. Recommended rules:
   - Cache Rule: `app.rooferslabs.com/assets/*` → cache everything, 1 year.
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
3. Copy `pk_live_…` / `sk_live_…` into Secrets Manager and the web image
   build args.
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
