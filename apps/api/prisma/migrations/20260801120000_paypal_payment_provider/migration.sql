-- Paddle is retired; PayPal replaces it.
--
-- `PaymentProvider` loses PADDLE and gains PAYPAL. Postgres cannot drop a value
-- from an enum in place, so the type is rebuilt and every column that uses it is
-- re-typed against the new one. Written by hand: `prisma migrate diff` renders
-- this as a drop-and-recreate of the type without touching the dependent
-- columns, which fails on the first ALTER.
--
-- DESTRUCTIVE STEP, deliberately explicit.
--
-- Rows stamped PADDLE name identifiers that exist only in Paddle — a customer
-- id, a subscription id, a transaction id. None of them resolve to anything in
-- PayPal, and BillingService.assertSameProvider already refused to manage such a
-- row: a tenant holding one was told to start a fresh subscription. Once PADDLE
-- is not a representable value, those rows cannot be kept as they are, and there
-- is no honest value to convert them to. They are therefore removed, and the
-- counts are raised into the deploy log so the removal is a recorded fact rather
-- than a silent one.
--
-- `invoices` is a documented cache of the provider's own billing documents, not
-- an accounting record — Paddle remains the authority on anything it charged.
-- `webhook_events` is a dedupe ledger; a Paddle event id can never arrive again.

DO $$
DECLARE
  subscription_count INTEGER;
  invoice_count      INTEGER;
  event_count        INTEGER;
BEGIN
  SELECT count(*) INTO subscription_count FROM "subscriptions" WHERE "provider" = 'PADDLE';
  SELECT count(*) INTO invoice_count      FROM "invoices"      WHERE "provider" = 'PADDLE';
  SELECT count(*) INTO event_count        FROM "webhook_events" WHERE "provider" = 'PADDLE';

  RAISE NOTICE 'Paddle retirement: removing % subscription(s), % invoice(s), % webhook event(s).',
    subscription_count, invoice_count, event_count;
END $$;

DELETE FROM "invoices"       WHERE "provider" = 'PADDLE';
DELETE FROM "subscriptions"  WHERE "provider" = 'PADDLE';
DELETE FROM "webhook_events" WHERE "provider" = 'PADDLE';

-- Rebuild the type. The default is dropped first: a column default is parsed
-- against the type it was written for, so re-typing the column while
-- `DEFAULT 'PADDLE'` still hangs off it fails regardless of the data.
ALTER TABLE "subscriptions" ALTER COLUMN "provider" DROP DEFAULT;

ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";

CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL', 'STRIPE');

ALTER TABLE "subscriptions"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING ("provider"::text::"PaymentProvider");

ALTER TABLE "invoices"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING ("provider"::text::"PaymentProvider");

ALTER TABLE "webhook_events"
  ALTER COLUMN "provider" TYPE "PaymentProvider"
  USING ("provider"::text::"PaymentProvider");

DROP TYPE "PaymentProvider_old";

-- New rows belong to the active processor.
ALTER TABLE "subscriptions" ALTER COLUMN "provider" SET DEFAULT 'PAYPAL';
