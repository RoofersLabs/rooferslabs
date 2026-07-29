-- Provider-agnostic billing.
--
-- The billing tables stop naming a specific processor. `stripeCustomerId` and
-- friends become `providerCustomerId`, qualified by a new `provider` column, so
-- the schema supports whichever processor is configured rather than encoding one
-- of them in its column names.
--
-- Written by hand rather than taken from `prisma migrate diff`, which renders a
-- column rename as DROP + ADD. That would discard every existing billing row and
-- fail outright on a non-empty table (the new column is NOT NULL with no
-- default). RENAME COLUMN preserves the data and is instant — it rewrites
-- catalog entries, not rows.

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PADDLE', 'STRIPE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- AlterTable: rename the Stripe-specific columns, preserving their contents.
ALTER TABLE "subscriptions" RENAME COLUMN "stripeCustomerId" TO "providerCustomerId";
ALTER TABLE "subscriptions" RENAME COLUMN "stripeSubscriptionId" TO "providerSubscriptionId";
ALTER TABLE "subscriptions" RENAME COLUMN "stripePriceId" TO "providerPriceId";

-- Any row that already exists was created by the Stripe integration, so it is
-- backfilled as STRIPE. The default is then moved to PADDLE, which is what new
-- rows get. Doing it in two steps is what makes the backfill exact: there is no
-- moment at which an old row could pick up the new default.
ALTER TABLE "subscriptions" ADD COLUMN "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "subscriptions" ALTER COLUMN "provider" SET DEFAULT 'PADDLE';

ALTER TABLE "subscriptions" ADD COLUMN "billingInterval" "BillingInterval";

-- DropIndex: the single-column uniques were renamed along with their columns.
-- They are replaced by provider-scoped composites, so the same identifier may
-- legitimately exist under two processors.
DROP INDEX "subscriptions_stripeCustomerId_key";
DROP INDEX "subscriptions_stripeSubscriptionId_key";

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_providerCustomerId_key" ON "subscriptions"("provider", "providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_providerSubscriptionId_key" ON "subscriptions"("provider", "providerSubscriptionId");

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerInvoiceId" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL,
    "currency" TEXT NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "invoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "occurredAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_companyId_issuedAt_idx" ON "invoices"("companyId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_provider_providerInvoiceId_key" ON "invoices"("provider", "providerInvoiceId");

-- CreateIndex
CREATE INDEX "webhook_events_status_createdAt_idx" ON "webhook_events"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_providerEventId_key" ON "webhook_events"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
