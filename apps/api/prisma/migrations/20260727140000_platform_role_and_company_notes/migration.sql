-- Internal admin portal: platform-level authority + private operational notes.
--
-- `platformRole` is deliberately NOT `UserRole`. Every customer is already a
-- UserRole.OWNER (it is the column default assigned at signup), so reusing it
-- would grant the entire customer base access to the internal portal. This
-- column defaults to NONE, so access fails closed for every existing row and
-- every future signup.
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'OWNER');

ALTER TABLE "users" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE';

CREATE TABLE "company_notes" (
    "id"        TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_notes_companyId_createdAt_idx" ON "company_notes"("companyId", "createdAt");

ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
