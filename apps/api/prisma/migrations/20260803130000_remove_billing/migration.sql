-- Remove the billing and payment subsystem.
--
-- The MVP ships without payments: there is no checkout, no provider webhook and
-- no payment wall, so the four tables that existed only to mirror a processor's
-- state have nothing left to mirror. Pricing survives on the marketing site as
-- a "coming soon" experience, which needs no schema at all.
--
-- This is destructive by intent. Every row in these tables is a *cache* of state
-- the payment provider owns — subscriptions, invoices, provisioned catalogue
-- ids, and the webhook dedupe ledger — so dropping them loses no record of
-- truth. When billing returns it will be re-provisioned against whichever
-- processor is chosen then, and re-synced from that processor's own history.
--
-- Order matters: `invoices` carries foreign keys to both `subscriptions` and
-- `companies`, so it goes first. The enum types are dropped only after the last
-- column referencing them is gone, otherwise Postgres refuses with a dependency
-- error.
--
-- `ConversationIntent.BILLING` is deliberately untouched: it describes what a
-- caller phoned about, not how the tenant pays, and the receptionist still
-- classifies that intent.

DROP TABLE IF EXISTS "invoices";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "billing_catalog";
DROP TABLE IF EXISTS "webhook_events";

DROP TYPE IF EXISTS "InvoiceStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "SubscriptionPlan";
DROP TYPE IF EXISTS "BillingInterval";
DROP TYPE IF EXISTS "WebhookEventStatus";
DROP TYPE IF EXISTS "PaymentProvider";
