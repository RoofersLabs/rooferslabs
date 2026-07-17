# RoofersLabs — r1 echo

> AI-Powered Front Office Platform for roofing companies. The AI receptionist
> answers every inbound call, qualifies leads, detects emergencies, captures
> customer information, and delivers structured conversation records.

**r1 echo** is the first production-ready MVP: a TypeScript monorepo containing
the NestJS backend, the installable React PWA, shared contracts, the database
schema, and all infrastructure configuration.

The architecture is frozen and defined in [`docs/`](./docs) — canonical
reference: [`docs/00_GStack_Architecture.md`](./docs/00_GStack_Architecture.md).
Production deployment runbook: [`docs/13_Deployment_Guide.md`](./docs/13_Deployment_Guide.md).

---

## Technology stack

| Layer          | Technology                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend       | React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, React Hook Form, Zod, PWA |
| Backend        | NestJS, Node.js, TypeScript, Prisma ORM                                                                 |
| Database       | PostgreSQL (Amazon RDS) · Redis (cache) · Amazon SQS (jobs)                                             |
| Auth           | Clerk                                                                                                   |
| AI             | OpenAI Realtime API (voice) · OpenAI Responses API (structured outputs) · RAG knowledge base            |
| Telephony      | Twilio Programmable Voice + Media Streams                                                               |
| Infrastructure | AWS (ECS/Fargate, S3, Secrets Manager, CloudWatch), Docker, Cloudflare                                  |
| Payments       | Stripe (architecture reserved — not implemented in r1 echo)                                             |

---

## Project structure

```text
rooferslabs/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/             #   schema, migrations, seed
│   │   └── src/
│   │       ├── auth/           #   Clerk adapter, guards (auth/tenant/roles)
│   │       ├── companies/      #   onboarding, business + AI configuration
│   │       ├── knowledge/      #   knowledge base CRUD + chunk indexing
│   │       ├── ai/             #   OpenAI adapter + RAG retrieval
│   │       ├── receptionist/   #   Realtime session, tools, post-call analysis
│   │       ├── telephony/      #   Twilio webhooks + Media Streams bridge
│   │       ├── calls/          #   call pipeline, conversations
│   │       ├── customers/ appointments/ notifications/
│   │       ├── dashboard/ search/ users/ health/
│   │       ├── common/         #   envelope, filters, decorators, pagination
│   │       └── config/ prisma/ redis/
│   └── web/                    # React + Vite installable PWA
│       └── src/
│           ├── features/       #   landing, auth, onboarding, dashboard, calls,
│           │                   #   customers, appointments, knowledge,
│           │                   #   notifications, settings
│           ├── components/ layouts/ hooks/ state/ providers/
│           └── lib/ types/ styles/
├── packages/shared/            # contracts: enums, API envelope, AI types
├── docker/                     # Dockerfiles, nginx, docker-compose
├── docs/                       # frozen architecture (source of truth)
├── scripts/                    # icon generation etc.
└── .github/workflows/ci.yml    # typecheck + build + docker CI
```

---

## Third-party accounts required

| Service          | Purpose                                                | Where to sign up            |
| ---------------- | ------------------------------------------------------ | --------------------------- |
| **Clerk**        | Authentication (register, login, sessions)             | https://clerk.com           |
| **OpenAI**       | Realtime voice AI + Responses API + embeddings         | https://platform.openai.com |
| **Twilio**       | Phone numbers, inbound calls, Media Streams            | https://twilio.com          |
| **AWS**          | RDS, ECS/Fargate, S3, SQS, Secrets Manager, CloudWatch | https://aws.amazon.com      |
| **Cloudflare**   | DNS, TLS, WebSocket proxy, edge caching                | https://cloudflare.com      |
| Stripe _(later)_ | Billing (not in r1 echo)                               | https://stripe.com          |

## Every environment variable

Backend (root `.env` — full annotated reference in [`.env.example`](./.env.example)):

| Variable                                      | Required | Description                                                               |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `NODE_ENV`                                    | yes      | `development` / `production`                                              |
| `API_PORT`                                    | yes      | API port (default 4000)                                                   |
| `API_PUBLIC_URL`                              | yes      | Public API origin (webhooks, Swagger)                                     |
| `WEB_PUBLIC_URL`                              | yes      | Public PWA origin                                                         |
| `CORS_ORIGINS`                                | yes      | Comma-separated allowed origins                                           |
| `DATABASE_URL`                                | **yes**  | PostgreSQL connection string                                              |
| `REDIS_URL`                                   | yes      | Redis connection string                                                   |
| `CLERK_PUBLISHABLE_KEY`                       | **yes**  | Clerk `pk_…`                                                              |
| `CLERK_SECRET_KEY`                            | **yes**  | Clerk `sk_…` (server only)                                                |
| `CLERK_JWT_KEY`                               | no       | PEM key for offline JWT verification                                      |
| `CLERK_WEBHOOK_SECRET`                        | no       | Clerk webhook signing secret                                              |
| `OPENAI_API_KEY`                              | **yes*** | OpenAI API key (*AI features disabled without it)                         |
| `OPENAI_REALTIME_MODEL`                       | no       | default `gpt-realtime`                                                    |
| `OPENAI_RESPONSES_MODEL`                      | no       | default `gpt-4.1`                                                         |
| `OPENAI_EMBEDDING_MODEL`                      | no       | default `text-embedding-3-small`                                          |
| `TWILIO_ACCOUNT_SID`                          | **yes*** | Twilio account SID (*telephony)                                           |
| `TWILIO_AUTH_TOKEN`                           | **yes*** | Twilio auth token (webhook signatures)                                    |
| `TWILIO_PHONE_NUMBER`                         | **yes*** | Purchased Twilio number (E.164), auto-assigned to a company at onboarding |
| `TWILIO_MEDIA_STREAM_URL`                     | yes      | `wss://…/v1/telephony/media-stream`                                       |
| `AWS_REGION`                                  | yes      | AWS region                                                                |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | prod     | Omit on ECS (task role)                                                   |
| `S3_BUCKET_RECORDINGS` / `S3_BUCKET_UPLOADS`  | prod     | S3 bucket names                                                           |
| `SQS_QUEUE_URL`                               | no       | Jobs queue URL                                                            |
| `BACKGROUND_JOBS_INLINE`                      | no       | `true` = process jobs in-process (local dev)                              |
| `MIGRATE_ON_START`                            | no       | Container-only: run `migrate deploy` on boot                              |
| `LOG_LEVEL`                                   | no       | pino level (default `debug` dev / `info` prod)                            |

Frontend (`apps/web/.env` — see [`apps/web/.env.example`](./apps/web/.env.example)):

| Variable                     | Required | Description                           |
| ---------------------------- | -------- | ------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | **yes**  | Clerk publishable key (browser-safe)  |
| `VITE_API_BASE_URL`          | prod     | API origin; empty in dev (Vite proxy) |

## Every API key required

1. **Clerk publishable key** (`pk_test_…`/`pk_live_…`) — Clerk Dashboard → API Keys → backend `.env` **and** `apps/web/.env`.
2. **Clerk secret key** (`sk_test_…`/`sk_live_…`) — same page → backend `.env` only.
3. **OpenAI API key** (`sk-…`) — platform.openai.com → API keys → backend `.env`. Must have access to the Realtime and Responses APIs.
4. **Twilio Account SID + Auth Token** — Twilio Console home → backend `.env`.
5. **AWS access key pair** — IAM user for local/CLI use only; production uses ECS task roles.
6. **Cloudflare** — account credentials only (dashboard configuration, no key consumed by the app).

---

## Local development

```bash
# 0. Prerequisites: Node ≥ 20 (< 27), npm ≥ 10, Docker Desktop

# 1. Install
npm install

# 2. Environment
cp .env.example .env                 # fill in Clerk/OpenAI/Twilio keys
cp apps/web/.env.example apps/web/.env   # set VITE_CLERK_PUBLISHABLE_KEY

# 3. Infrastructure (PostgreSQL + Redis)
npm run db:up

# 4. Database
npm run build:shared
npm run prisma:generate
npm run prisma:migrate               # applies migrations (dev)
npm run prisma:seed                  # loads the "Summit Roofing Co." demo tenant

# 5. Run (two terminals)
npm run dev:api                      # http://localhost:4000 — Swagger at /docs
npm run dev:web                      # http://localhost:5173
```

To exercise a real phone call locally, expose the API with a tunnel
(e.g. `ngrok http 4000`), set `API_PUBLIC_URL` and
`TWILIO_MEDIA_STREAM_URL=wss://<tunnel>/v1/telephony/media-stream`, and point a
Twilio number's voice webhook at `https://<tunnel>/v1/telephony/incoming`.

## Database migrations

```bash
npm run prisma:migrate                                   # dev: create + apply
npm run prisma:migrate:deploy --workspace @rooferslabs/api   # prod: apply committed
npm run prisma:seed                                      # demo data (idempotent)
npx --prefix apps/api prisma studio                      # inspect data
```

Production containers apply pending migrations automatically at startup
(`MIGRATE_ON_START=true`).

## Docker commands

```bash
npm run db:up                # postgres + redis only
npm run docker:up            # full stack (db + redis + api + web)
npm run docker:down

# Individual production images (from repo root)
docker build -f docker/api.Dockerfile -t rooferslabs-api .
docker build -f docker/web.Dockerfile \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx \
  --build-arg VITE_API_BASE_URL=https://api.rooferslabs.com \
  -t rooferslabs-web .
```

## Deployment (Vercel + AWS + Cloudflare)

**Frontend → Vercel** (configured by [`/vercel.json`](./vercel.json)): import
the repo, add the `app.` domain, set `VITE_CLERK_PUBLISHABLE_KEY` and
`VITE_API_BASE_URL`; production deploys ride pushes to the production branch.

**Backend → AWS, all Terraform** — VPC, ALB/ACM, ECR, ECS Fargate, RDS,
ElastiCache, S3, SQS, Secrets Manager, IAM, CloudWatch:

```bash
cd infra/terraform/envs/production
cp terraform.tfvars.example terraform.tfvars   # domain + Clerk/OpenAI/Twilio/VAPID keys
terraform init && terraform apply
../../scripts/deploy.sh                        # build + push + roll the API service
```

From-scratch walkthrough: [`infra/terraform/README.md`](./infra/terraform/README.md).
The operational runbook — releases, rollback, and all Cloudflare settings
(DNS, Full-strict TLS, **WebSockets ON**, cache rules) — is in
[`docs/13_Deployment_Guide.md`](./docs/13_Deployment_Guide.md).

---

## Twilio phone forwarding setup (per customer)

Each roofing company **keeps its existing business number** and forwards it to
its assigned Twilio number (shown in the app under **Settings → Phone Setup**,
which walks the customer through this):

1. **Assign a Twilio number** to the company (early access: provision in the
   Twilio console, then `POST /v1/telephony/phone-numbers/assign`).
2. **Configure the number's webhooks** (see deployment guide §6):
   voice → `/v1/telephony/incoming`, status → `/v1/telephony/status`.
3. **Customer forwards their line** from their business phone:
   - Unconditional (all calls): dial `*72` + the Twilio number. Disable: `*73`.
   - Conditional (busy/no answer): `*71` or `*90` + the number (carrier-dependent).
   - VoIP/business systems: set forwarding in the provider portal.
4. **Test call** — call the business number from another phone; the AI answers
   with the configured greeting.
5. **Verify in app** — Settings → Phone Setup → “mark as verified”.

## Clerk configuration

1. Create a Clerk application → enable **Email + Password** (optionally Google).
2. Copy the **publishable key** into root `.env` (`CLERK_PUBLISHABLE_KEY`) and
   `apps/web/.env` (`VITE_CLERK_PUBLISHABLE_KEY`).
3. Copy the **secret key** into root `.env` (`CLERK_SECRET_KEY`).
4. Dev needs nothing else. Production: add your domain, complete Clerk's DNS
   records (Cloudflare: **DNS only**, not proxied), use `pk_live_/sk_live_` keys.
5. Users are provisioned in the platform database automatically on their first
   authenticated request — no webhook required for the MVP.

## OpenAI configuration

1. Create an API key at platform.openai.com with access to **Realtime**,
   **Responses**, and **Embeddings**; set `OPENAI_API_KEY`.
2. Models are configurable via env (`gpt-realtime`, `gpt-4.1`,
   `text-embedding-3-small` by default).
3. Set a monthly budget limit in the OpenAI dashboard; voice minutes dominate cost.
4. Without a key the platform still runs: knowledge retrieval falls back to
   keyword search and calls cannot be AI-answered (fails safe).

---

## Testing checklist

**Build & boot**

- [ ] `npm install && npm run build` succeeds from a clean clone
- [ ] `npm run typecheck` passes in all three workspaces
- [ ] `npm run db:up && npm run prisma:migrate && npm run prisma:seed` initializes the database
- [ ] `GET /v1/health` → `ok`; `GET /v1/health/ready` → database + cache `true`
- [ ] Swagger renders at `http://localhost:4000/docs`

**Authentication & tenancy**

- [ ] Register a new account (Clerk) → lands on onboarding
- [ ] Log out / log in → session restored; `GET /v1/auth/me` returns user + company
- [ ] All `/v1/*` business endpoints reject requests without a bearer token (401)
- [ ] A second registered company cannot read the first company's data (404/403 on foreign ids)

**Onboarding journey**

- [ ] Create company → Business step (services, areas, emergency) → AI step
      (name, voice, greeting) → Knowledge step → Complete → Dashboard
- [ ] Refresh mid-wizard → resumes at the saved step

**Dashboard & operations**

- [ ] Dashboard shows today's calls / leads / emergencies / pending appointments (seed data visible for demo tenant)
- [ ] Calls list renders; conversation detail shows transcript, AI summary, key points, extracted details
- [ ] Customers: search, create, edit
- [ ] Appointments: filter by status; change status inline
- [ ] Knowledge base: create, edit, delete, search, category filter
- [ ] Notifications: unread badge in sidebar/header; mark read; mark all read; deep-link to conversation
- [ ] Global header search returns customers / conversations / appointments / articles

**AI receptionist & telephony (requires OpenAI + Twilio keys and a tunnel or deploy)**

- [ ] Inbound call to the Twilio number → AI answers with the configured greeting
- [ ] Caller question about services → answered from knowledge base content only
- [ ] Caller gives name/phone/address → customer record created/enriched after the call
- [ ] Caller requests an estimate → appointment request created + notification
- [ ] Caller reports an active leak → conversation flagged emergency + critical notification
- [ ] Call completion → transcript, summary, structured output stored; call marked COMPLETED
- [ ] Interrupting the AI mid-sentence stops its speech (barge-in)
- [ ] Invalid Twilio signature is rejected in production mode

**PWA**

- [ ] Lighthouse: installable PWA, no console errors
- [ ] "Add to Home Screen" appears in the top nav; disappears after install
- [ ] Installed app opens standalone with the RoofersLabs icon
- [ ] Previously visited pages render offline (app shell); API data refetches on reconnect

## Installing the PWA

**Android (Chrome)**

1. Open `https://app.rooferslabs.com`, sign in.
2. Tap **Add to Home Screen** in the top navigation (or Chrome menu ⋮ → _Add to Home screen_).
3. Confirm — the RoofersLabs icon appears on the home screen and opens full-screen.

**iPhone / iPad (Safari)**

1. Open `https://app.rooferslabs.com` in **Safari**, sign in.
2. Tap the top-nav **Install** button to see guided steps, or directly:
   tap **Share** □↑ → **Add to Home Screen** → **Add**.
3. Launch from the home-screen icon; it runs standalone like a native app.

---

## Remaining manual tasks before production

1. **Credentials** — create production Clerk instance, OpenAI key with billing
   limit, Twilio account with a purchased number, AWS account, Cloudflare zone.
   Put them in `infra/terraform/envs/production/terraform.tfvars` — Terraform
   populates Secrets Manager for you.
2. **Provision AWS** — `terraform apply` per `infra/terraform/README.md`
   (VPC, RDS, Redis, S3, ECR, ECS, ALB/ACM, IAM, Secrets, CloudWatch alarms).
3. **Cloudflare** — DNS, Full (strict) TLS, WebSockets ON, cache rules (§5).
4. **Twilio** — point each number's webhooks at the production API (§6) and
   assign numbers to tenants.
5. **Recording storage** — enable Twilio call recording + S3 upload if
   recordings are required for early access (schema and playback UI are ready;
   `recordingUrl` is populated when configured).
6. **SQS workers** — post-call processing currently runs inline
   (`BACKGROUND_JOBS_INLINE=true`), which is adequate at early-access volume;
   move summarization to SQS consumers as call volume grows.
7. **Run the full testing checklist** above, including one real forwarded call
   per onboarded company.
8. **Legal/compliance** — call-recording disclosure in the AI greeting where
   state law requires two-party consent; privacy policy + terms on the landing page.

## License

Proprietary — © RoofersLabs. All rights reserved.
