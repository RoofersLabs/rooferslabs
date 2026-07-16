# RoofersLabs — AWS Infrastructure (Terraform)

Everything RoofersLabs needs in AWS, provisioned as code. A developer with AWS
credentials can go from an empty account to a running production stack with the
steps below — no manual console configuration except the external services
(Cloudflare DNS, Clerk, OpenAI, Twilio) that inherently require it.

## What gets created

| Module          | Resources                                                               |
| --------------- | ----------------------------------------------------------------------- |
| `networking`    | VPC, 2×public + 2×private subnets, IGW, NAT gateway, route tables       |
| `ecr`           | `rooferslabs/api` + `rooferslabs/web` repositories, lifecycle policies  |
| `alb`           | Application Load Balancer, target groups, ACM certificate, host routing |
| `rds`           | PostgreSQL 16 (encrypted, backups, generated password)                  |
| `redis`         | ElastiCache Redis 7                                                     |
| `s3`            | Private `recordings` + `uploads` buckets (KMS, public access blocked)   |
| `secrets`       | Secrets Manager entries for the DB URL and external credentials         |
| `iam`           | ECS execution role (scoped secret reads) + task role (scoped S3)        |
| `observability` | CloudWatch log groups, ALB 5xx + API CPU alarms, optional SNS email     |
| `ecs-service`   | Fargate task definition + service (used twice: api and web)             |

Traffic flow: Cloudflare → ALB (`api.<domain>` → NestJS :4000,
`app.<domain>` → nginx :80) → ECS tasks in private subnets → RDS/Redis.
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

# 2. Provision everything (HTTP phase).
terraform init
terraform apply

# 3. HTTPS: add the ACM validation CNAMEs to Cloudflare (DNS-only/grey cloud).
terraform output acm_validation_records
#    …wait a few minutes for the certificate to issue, then:
terraform apply -var 'enable_https=true'     # or set enable_https = true in tfvars

# 4. Point your hostnames at the ALB in Cloudflare (proxied is fine —
#    enable WebSockets in the Cloudflare Network settings):
terraform output alb_dns_name
#    api.<domain>  CNAME  <alb_dns_name>
#    app.<domain>  CNAME  <alb_dns_name>

# 5. Build and deploy the application (database migrations run automatically
#    when the API container boots).
../../scripts/deploy.sh

# 6. Verify.
curl https://api.<domain>/v1/health/ready
open https://app.<domain>
```

## Wire up external services (one time)

- **Twilio** — on each phone number, set:
  - Voice webhook (POST): `terraform output twilio_voice_webhook`
  - Status callback (POST): `terraform output twilio_status_callback`
- **Clerk** — production instance with `app.<domain>` as the application domain.
- **Cloudflare** — the two CNAMEs from step 4 + WebSockets enabled.

That's it: register in the app, complete onboarding, assign the Twilio number
to the company (`POST /v1/telephony/phone-numbers/assign` as the owner — see
`/docs` Swagger), forward the business line, and place a real call.

## Day-2 operations

```bash
../../scripts/deploy.sh api            # ship a new API build
../../scripts/deploy.sh web            # ship a new web build
terraform apply                        # any infrastructure change

# Rotate an external credential: update terraform.tfvars, then
terraform apply && ../../scripts/deploy.sh api   # restart picks up the new secret

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
- **Cost** (defaults, us-east-1, rough): NAT ~$33/mo, ALB ~$20/mo,
  2×Fargate tasks ~$25/mo, db.t4g.micro ~$12/mo, cache.t4g.micro ~$12/mo —
  ≈ **$100–110/month** before traffic.
- **RDS deletion protection** is on by default (`db_deletion_protection=false`
  to allow teardown). `terraform destroy` will refuse to delete non-empty
  ECR repos/S3 buckets unless `force_delete`/`force_destroy` are set.
- Scaling levers in `terraform.tfvars`: `api_desired_count`, `db_multi_az`,
  `db_instance_class`, `redis_node_type`, `alarm_email`.
