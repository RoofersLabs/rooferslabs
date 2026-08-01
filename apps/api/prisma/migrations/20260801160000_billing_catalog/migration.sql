-- What the provisioner created at the payment provider.
--
-- Purely additive: a new table and its unique index, no change to any existing
-- column. Applying it on a running deployment is safe and instant.
--
-- The unique index is the idempotency guarantee. `npm run billing:paypal:setup`
-- upserts on (provider, environment, key), so running it twice — or twice
-- concurrently, from two ECS tasks — cannot produce two rows claiming to be the
-- same plan.

-- CreateTable
CREATE TABLE "billing_catalog" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "environment" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_catalog_provider_environment_key_key"
    ON "billing_catalog"("provider", "environment", "key");
