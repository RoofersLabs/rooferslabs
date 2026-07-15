# RoofersLabs — r1 echo

> AI-Powered Front Office Platform for roofing companies. The AI receptionist
> answers every inbound call, qualifies leads, detects emergencies, captures
> customer information, and delivers structured conversation records.

**r1 echo** is the first production-ready MVP. This repository is a TypeScript
monorepo containing the backend API, the installable PWA frontend, shared
contracts, database schema, and infrastructure.

The architecture is frozen and defined in [`docs/`](./docs). The canonical
technical reference is [`docs/00_GStack_Architecture.md`](./docs/00_GStack_Architecture.md).

---

## Technology stack

| Layer          | Technology                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Frontend       | React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, TanStack Query, React Hook Form, Zod, PWA |
| Backend        | NestJS, Node.js, TypeScript, Prisma ORM                                    |
| Database       | PostgreSQL (Amazon RDS)                                                     |
| Cache / Queue  | Redis, Amazon SQS                                                          |
| Auth           | Clerk                                                                       |
| AI             | OpenAI Realtime API, OpenAI Responses API, RAG knowledge base              |
| Telephony      | Twilio + Twilio Media Streams                                              |
| Infrastructure | AWS (ECS/Fargate, S3, Secrets Manager, CloudWatch), Docker, Cloudflare     |

---

## Repository structure

```text
rooferslabs/
├── apps/
│   ├── api/            # NestJS backend (domain modules, Prisma, telephony, AI)
│   │   └── prisma/     # schema, migrations, seed
│   └── web/            # React + Vite installable PWA
├── packages/
│   └── shared/         # shared contracts, enums, API envelope, AI types
├── docker/             # Dockerfiles + docker-compose (local infra)
├── docs/               # frozen architecture & specifications (source of truth)
├── scripts/
└── .env.example        # master environment reference
```

npm workspaces link the packages together; `@rooferslabs/shared` is consumed by
both apps.

---

## Prerequisites

- **Node.js** ≥ 20 (< 27) and npm ≥ 10
- **Docker** + Docker Compose (for local PostgreSQL and Redis)
- Accounts / API keys for external services (see [Environment](#environment)):
  Clerk, OpenAI, Twilio, and (for deployment) AWS + Cloudflare.

---

## Quick start (local development)

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    …then fill in credentials (Clerk, OpenAI, Twilio). See comments in .env.

# 3. Start PostgreSQL + Redis
npm run db:up

# 4. Build shared contracts, generate the Prisma client, run migrations, seed
npm run build:shared
npm run prisma:generate
npm run prisma:migrate      # creates the schema in your local database
npm run prisma:seed         # loads the "Summit Roofing Co." demo tenant

# 5. Run the apps (in two terminals)
npm run dev:api             # http://localhost:4000  (Swagger at /docs)
npm run dev:web             # http://localhost:5173
```

The frontend also needs its own env file — copy `apps/web/.env.example` to
`apps/web/.env` and set `VITE_CLERK_PUBLISHABLE_KEY`.

---

## Common scripts

| Command                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `npm run build`            | Build shared → api → web                             |
| `npm run dev:api`          | Run the backend in watch mode                        |
| `npm run dev:web`          | Run the frontend dev server                          |
| `npm run typecheck`        | Type-check every workspace                           |
| `npm run lint`             | Lint every workspace                                 |
| `npm run test`             | Run tests across workspaces                          |
| `npm run db:up` / `db:down`| Start / stop local Postgres + Redis                  |
| `npm run prisma:migrate`   | Create & apply a dev migration                       |
| `npm run prisma:seed`      | Seed demo data                                       |
| `npm run docker:up`        | Build & run the full stack in Docker                 |

---

## Environment

All configuration is documented inline in [`.env.example`](./.env.example),
grouped by service, with notes on **which service** each value comes from,
**why** it is needed, and **where** to configure it. In production these values
are delivered via **AWS Secrets Manager**.

---

## Documentation

The `docs/` directory is the single source of truth. Start with
`00_Master_Project_Specification.md` (product) and
`00_GStack_Architecture.md` (technical). Deployment, Cloudflare, Twilio, Clerk,
and OpenAI setup guides live at the end of this README (see the deployment
section, completed in milestone M9).

---

## License

Proprietary — © RoofersLabs. All rights reserved.
