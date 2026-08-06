-- Founder approval: a tenant that finishes setup waits for a human decision
-- before it may use anything.
--
-- `companies.status` becomes the single source of truth for access, so the
-- lifecycle it already modelled is extended rather than duplicated:
--
--     ONBOARDING -> PENDING_APPROVAL -> ACTIVE <-> PAUSED
--
-- SUSPENDED is *renamed*, not joined by a near-synonym. Nothing in the
-- application ever wrote it, so no row changes meaning — and one word for "this
-- tenant is switched off" is what keeps the value the founder sets and the
-- value the guard checks from drifting apart.
ALTER TYPE "CompanyStatus" RENAME VALUE 'SUSPENDED' TO 'PAUSED';

-- PostgreSQL 12+ permits ADD VALUE inside the transaction Prisma wraps a
-- migration in, provided the new label is not *used* in that same transaction.
-- Nothing below writes 'PENDING_APPROVAL', which is deliberate: see the
-- backfill note.
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL' BEFORE 'ACTIVE';

-- Who decided, and when. Authorization never reads these — `status` alone
-- decides — they exist so the portal can show the history of a decision and so
-- an audit can be reconstructed from the tenant row as well as the audit log.
ALTER TABLE "companies"
    ADD COLUMN "approvedAt"  TIMESTAMP(3),
    ADD COLUMN "approvedBy"  TEXT,
    ADD COLUMN "pausedAt"    TIMESTAMP(3),
    ADD COLUMN "pausedBy"    TEXT,
    ADD COLUMN "pauseReason" TEXT;

-- Grandfathering, and the reason no row is set to PENDING_APPROVAL here.
--
-- Every existing ACTIVE tenant was admitted under the old rules and is using
-- the product right now. Applying the new gate retroactively would lock all of
-- them out at deploy time, which is a migration that takes the platform down
-- rather than one that adds a feature. They keep ACTIVE and are given the date
-- they became so; `approvedBy` stays NULL, which is the honest record — no
-- member of staff approved them, the old code did.
--
-- Tenants still in ONBOARDING are untouched: they reach PENDING_APPROVAL by
-- finishing the wizard, the same as every tenant that signs up after this.
UPDATE "companies"
SET "approvedAt" = COALESCE("onboardedAt", "createdAt")
WHERE "status" = 'ACTIVE' AND "approvedAt" IS NULL;
