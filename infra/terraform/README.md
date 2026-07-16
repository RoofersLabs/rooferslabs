# RoofersLabs — AWS Infrastructure (Terraform)

Everything the RoofersLabs **backend** needs in AWS, provisioned as code. The
**frontend is hosted on Vercel** (configured by `/vercel.json` at the repo
root) — this stack serves the API only. A developer with AWS credentials can
go from an empty account to a running production stack with the steps below —
no manual console configuration except the external services (Cloudflare DNS,
Vercel, Clerk, OpenAI, Twilio) that inherently require it.

## What gets created

| Module          | Resources                                                              |
| --------------- | ---------------------------------------------------------------------- |
| `networking`    | VPC, 2×public + 2×private subnets, IGW, NAT gateway, route tables      |
| `ecr`           | `rooferslabs/api` repository, lifecycle policies                       |
| `alb`           | Application Load Balancer (API origin), ACM certificate, listeners     |
| `rds`           | PostgreSQL 16 (encrypted, backups, generated password)                 |
| `redis`         | ElastiCache Redis 7 (cache + global rate limiting)                     |
| `s3`            | Private `recordings` + `uploads` buckets (KMS, public access blocked)  |
| `sqs`           | Background-jobs queue + 14-day DLQ (provisioned for a future release)  |
| `secrets`       | Secrets Manager entries for the DB URL and external credentials        |
| `iam`           | ECS execution role (scoped secret reads) + task role (scoped S3 + SQS) |
| `observability` | CloudWatch log group, ALB 5xx + API CPU alarms, optional SNS email     |
| `ecs-service`   | Fargate task definition + service (api)                                |

Traffic flow:

```text
Browser/PWA ── Cloudflare ── app.<domain> ──► Vercel (static frontend)
Twilio + PWA ─ Cloudflare ── api.<domain> ──► ALB ──► ECS api task (private)
                                                        │
                                          RDS · Redis · S3 · SQS · CloudWatch
```

WebSockets (Twilio Media Streams) pass through the ALB natively.

## Prerequisites

- Terraform ≥ 1.6, Docker, AWS CLI v2 authenticated against the target account
  (`aws sts get-caller-identity` should work)
- A domain whose DNS is managed in Cloudflare, and a Vercel account
- Credentials from Clerk (production instance), OpenAI, and Twilio
- A VAPID key pair for Web Push: `npx web-push generate-vapid-keys`

## From scratch to running

```bash
cd infra/terraform/envs/production

# 1. Configure — only external credentials and your domain are required.
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars           # never committed (gitignored)

# 2. Provision the backend (HTTP phase).
terraform init
terraform apply

# 3. HTTPS: add the ACM validation CNAMEs to Cloudflare (DNS-only/grey cloud).
terraform output acm_validation_records
#    …wait a few minutes for the certificate to issue, then:
terraform apply -var 'enable_https=true'     # or set enable_https = true in tfvars

# 4. Cloudflare DNS:
terraform output alb_dns_name
#    api.<domain>  CNAME  <alb_dns_name>        (proxied ☁️, WebSockets ON)
#    app.<domain>  CNAME  cname.vercel-dns.com  (per the Vercel domain wizard)

# 5. Deploy the API (database migrations run automatically on boot).
../../scripts/deploy.sh

# 6. Frontend on Vercel: import this repository (vercel.json drives the
#    monorepo build), add the domain app.<domain>, and set the env vars:
#      VITE_CLERK_PUBLISHABLE_KEY = pk_live_…
#      VITE_API_BASE_URL          = https://api.<domain>
#    Production deploys ride pushes to the production branch.

# 7. Verify.
curl https://api.<domain>/v1/health/ready
open https://app.<domain>
```

## Wire up external services (one time)

- **Twilio** — on each phone number, set:
  - Voice webhook (POST): `terraform output twilio_voice_webhook`
  - Status callback (POST): `terraform output twilio_status_callback`
- **Clerk** — production instance with `app.<domain>` as the application
  domain (its DNS records go in Cloudflare as DNS-only).
- **Cloudflare** — records from step 4; do not enable Rocket Loader or
  auto-minify on the app host (breaks service-worker precache hashes).

That's it: register in the app, complete onboarding, assign the Twilio number
to the company (`POST /v1/telephony/phone-numbers/assign` as the owner — see
`/docs` Swagger), forward the business line, and place a real call.

## Day-2 operations

```bash
../../scripts/deploy.sh                # ship a new API build
git push origin main                   # ship the frontend (Vercel auto-deploys)
terraform apply                        # any infrastructure change

# Rotate an external credential: update terraform.tfvars, then
terraform apply && ../../scripts/deploy.sh   # restart picks up the new secret

# Logs
aws logs tail /rooferslabs-production/api --follow

# Shell into a running API task (ECS Exec is enabled)
aws ecs execute-command --cluster rooferslabs-production \
  --task <task-id> --container api --interactive --command "/bin/sh"
```

## State, cost, and safety notes

- **State** is local by default. For teams, create an S3 state bucket once and
  uncomment the `backend "s3"` block in `providers.tf`, then
  `terraform init -migrate-state`.
- **Cost** (defaults, us-east-1, rough): NAT ~$33/mo, ALB ~$20/mo, API Fargate
  task ~$18/mo, db.t4g.micro ~$12/mo, cache.t4g.micro ~$12/mo, SQS ~$0 idle —
  ≈ **$95–105/month** before traffic. Vercel frontend: free/Pro tier.
- **RDS deletion protection** is on by default (`db_deletion_protection=false`
  to allow teardown). `terraform destroy` will refuse to delete non-empty
  ECR repos/S3 buckets unless `force_delete`/`force_destroy` are set.
- **SQS** is provisioned (queue, DLQ, task-role permissions, `SQS_QUEUE_URL`
  injected) but the application processes jobs inline until a consumer ships
  in a future release — flipping `BACKGROUND_JOBS_INLINE` will then be the
  only change.
- Scaling levers in `terraform.tfvars`: `api_desired_count`, `db_multi_az`,
  `db_instance_class`, `redis_node_type`, `alarm_email`.
