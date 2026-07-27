# RoofersLabs — AWS Infrastructure (Terraform)

Everything RoofersLabs needs in AWS, provisioned as code — **frontend and
backend**. The frontend is a static Vite SPA served from **S3 + CloudFront**
(module `frontend-cdn`); the backend API runs on ECS behind an ALB. A developer
with AWS credentials can go from an empty account to a running production stack
with the steps below — no manual console configuration except the external
services (Cloudflare DNS, Clerk, OpenAI, Twilio) that inherently require it.

## What gets created

| Module          | Resources                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `frontend-cdn`  | Private SPA S3 bucket + CloudFront (OAC), ACM cert, cache/security-header policies, SPA error routing, access logs |
| `networking`    | VPC, 2×public + 2×private subnets, IGW, NAT gateway, route tables                                                  |
| `ecr`           | `rooferslabs/api` repository, lifecycle policies                                                                   |
| `alb`           | Application Load Balancer (API origin), ACM certificate, listeners                                                 |
| `rds`           | PostgreSQL 16 (encrypted, backups, generated password)                                                             |
| `redis`         | ElastiCache Redis 7 (cache + global rate limiting)                                                                 |
| `s3`            | Private `recordings` + `uploads` buckets (KMS, public access blocked)                                              |
| `sqs`           | Background-jobs queue + 14-day DLQ (provisioned for a future release)                                              |
| `secrets`       | Secrets Manager entries for the DB URL and external credentials                                                    |
| `iam`           | ECS execution role (scoped secret reads) + task role (scoped S3 + SQS)                                             |
| `observability` | CloudWatch log group, ALB 5xx + API CPU alarms, optional SNS email                                                 |
| `ecs-service`   | Fargate task definition + service (api)                                                                            |

Traffic flow:

```text
Browser/PWA ── Cloudflare ── rooferslabs.com / www ──┐
Staff ──────── Cloudflare ── admin.<domain> ─────────┼► CloudFront ──► S3 (SPA)
Twilio + PWA ─ Cloudflare ── api.<domain> ───────────► ALB ──► ECS api task (private)
                                                                │
                                                  RDS · Redis · S3 · SQS · CloudWatch
```

The admin portal is a route inside the same SPA, served by the same bucket and
the same distribution — a second distribution would serve identical bytes. A
CloudFront viewer-request function sends `admin.<domain>/` to `/admin`, so the
marketing page is never delivered to the admin hostname. Its pages are separate
lazy chunks, so a customer downloads none of it.

To expose the hostname, run `infra/scripts/enable-admin-domain.sh`: it applies
both Terraform stages and prints the Cloudflare records to add while the
certificate validates. The apex and www keep serving on the existing certificate
throughout.

WebSockets (Twilio Media Streams) pass through the ALB natively.

## Prerequisites

- Terraform ≥ 1.6, Docker, AWS CLI v2 authenticated against the target account
  (`aws sts get-caller-identity` should work)
- A domain whose DNS is managed in Cloudflare
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

# 4. Frontend HTTPS: add the web ACM validation CNAMEs to Cloudflare (DNS-only),
#    wait for the cert to issue, then attach the apex + www aliases.
terraform output web_certificate_validation_records
# Set this in tfvars, do NOT pass it only as -var: a flag that lives on the
# command line is absent from the next plan, which then reads as "detach the
# apex + www aliases and fall back to the default certificate" — i.e. it takes
# the public site off its own domain.
terraform apply -var 'enable_web_custom_domain=true'   # then persist it in tfvars

# 5. Cloudflare DNS:
terraform output alb_dns_name web_cloudfront_domain
#    api.<domain>       CNAME  <alb_dns_name>          (proxied ☁️, WebSockets ON)
#    rooferslabs.com    CNAME  <web_cloudfront_domain> (proxied ☁️)
#    www.rooferslabs.com CNAME <web_cloudfront_domain> (proxied ☁️, redirect → apex)

# 6. Deploy the API (database migrations run automatically on boot).
../../scripts/deploy.sh

# 7. Deploy the frontend to S3 + CloudFront (builds with VITE_* from TF outputs):
../../scripts/deploy-web.sh

# 8. Verify.
curl https://api.<domain>/v1/health/ready
open https://rooferslabs.com
```

## Wire up external services (one time)

- **Twilio** — on each phone number, set:
  - Voice webhook (POST): `terraform output twilio_voice_webhook`
  - Status callback (POST): `terraform output twilio_status_callback`
- **Clerk** — production instance with `rooferslabs.com` as the application
  domain (its DNS records go in Cloudflare as DNS-only).
- **Cloudflare** — records from step 5; do not enable Rocket Loader or
  auto-minify on the web host (breaks service-worker precache hashes).

That's it: register in the app, complete onboarding, assign the Twilio number
to the company (`POST /v1/telephony/phone-numbers/assign` as the owner — see
`/docs` Swagger), forward the business line, and place a real call.

## Day-2 operations

```bash
../../scripts/deploy.sh                # ship a new API build
../../scripts/deploy-web.sh            # ship the frontend (S3 + CloudFront)
terraform apply                        # any infrastructure change

# Rotate an external credential: update terraform.tfvars, then
terraform apply && ../../scripts/deploy.sh   # restart picks up the new secret

# Logs
aws logs tail /rooferslabs-production/api --follow

# Shell into a running API task (ECS Exec is enabled)
aws ecs execute-command --cluster rooferslabs-production \
  --task <task-id> --container api --interactive --command "/bin/sh"
```

## Deploying from CI (GitHub Actions)

Both deploy workflows assume `module.github_oidc`'s role over OIDC, so no AWS
access key is ever stored in GitHub. The trust policy only accepts runs from
`main` and `develop` on the repo named by `var.github_repository` — a fork or a
feature branch cannot assume it.

The workflows are wrappers around the same two scripts used above, and every
value the scripts would read from Terraform outputs is passed in as an Actions
variable, so CI needs no Terraform state. After `terraform apply`, sync them:

```bash
tf() { terraform -chdir=infra/terraform/envs/production output -raw "$1"; }
gh variable set AWS_REGION          --body "$(tf aws_region)"
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(tf github_deploy_role_arn)"
gh variable set WEB_BUCKET          --body "$(tf web_bucket)"
gh variable set WEB_DISTRIBUTION_ID --body "$(tf web_distribution_id)"
gh variable set VITE_API_BASE_URL   --body "$(tf api_url)"
gh variable set WEB_VERIFY_URL      --body "$(tf web_url)"
gh variable set ECS_CLUSTER         --body "$(tf ecs_cluster_name)"
gh variable set API_SERVICE         --body "$(tf api_service_name)"
gh variable set API_HEALTH_URL      --body "$(tf api_url)/v1/health"
gh secret   set VITE_CLERK_PUBLISHABLE_KEY --body "$(tf clerk_publishable_key)"
# API_REPO is a map member, so it does not come from `output -raw`:
gh variable set API_REPO --body "$(terraform -chdir=infra/terraform/envs/production \
  output -json ecr_repository_urls | python3 -c 'import json,sys; print(json.load(sys.stdin)["api"])')"
```

Both workflows fail with an explicit list of what is missing if a variable is
unset, rather than surfacing the AWS action's opaque "Input required and not
supplied: aws-region". Neither is load-bearing: the scripts remain the source of
truth and can always ship from a laptop.

## State, cost, and safety notes

- **State** is local by default. For teams, create an S3 state bucket once and
  uncomment the `backend "s3"` block in `providers.tf`, then
  `terraform init -migrate-state`.
- **Cost** (defaults, us-east-1, rough): NAT ~$33/mo, ALB ~$20/mo, API Fargate
  task ~$18/mo, db.t4g.micro ~$12/mo, cache.t4g.micro ~$12/mo, SQS ~$0 idle —
  ≈ **$95–105/month** before traffic. CloudFront + S3 frontend: ~$1–5/month at
  low traffic (plus per-GB egress).
- **RDS deletion protection** is on by default (`db_deletion_protection=false`
  to allow teardown). `terraform destroy` will refuse to delete non-empty
  ECR repos/S3 buckets unless `force_delete`/`force_destroy` are set.
- **SQS** is provisioned (queue, DLQ, task-role permissions, `SQS_QUEUE_URL`
  injected) but the application processes jobs inline until a consumer ships
  in a future release — flipping `BACKGROUND_JOBS_INLINE` will then be the
  only change.
- Scaling levers in `terraform.tfvars`: `api_desired_count`, `db_multi_az`,
  `db_instance_class`, `redis_node_type`, `alarm_email`.
