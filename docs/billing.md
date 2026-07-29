# Billing

RoofersLabs bills through **Paddle**. Stripe remains fully implemented in the
codebase but is dormant: never constructed, never loaded, and refuses every call.
Switching between them is a configuration change.

- [Architecture](#architecture)
- [Paddle setup](#paddle-setup)
- [Environment variables](#environment-variables)
- [Webhooks](#webhooks)
- [Deployment](#deployment)
- [Local development](#local-development)
- [Re-enabling Stripe](#re-enabling-stripe)
- [Migration notes](#migration-notes)

---

## Architecture

Everything above the adapter boundary is provider-agnostic. No page, route,
service, repository, or database column names a payment processor.

```
apps/api/src/billing/
├── billing.controller.ts        Tenant-facing HTTP surface (provider-neutral)
├── billing.module.ts            Binds ONE adapter, mounts ONE webhook route
├── interfaces/
│   └── billing-provider.interface.ts   The port. BillingService depends on this alone.
├── types/billing.types.ts       The provider-neutral vocabulary
├── services/
│   ├── billing.service.ts       The single entry point to billing
│   └── webhook-processor.service.ts   Verify → deduplicate → apply
├── repositories/
│   ├── billing.repository.ts    Subscription read-model
│   ├── invoice.repository.ts    Synchronized billing documents
│   └── webhook-event.repository.ts    The idempotency ledger
├── providers/
│   ├── paddle/                  ACTIVE — the only files importing the Paddle SDK
│   └── stripe/                  DORMANT — preserved, compile-checked, inert
└── webhooks/
    ├── paddle-webhook.controller.ts
    └── stripe-webhook.controller.ts    Not registered while Paddle is active
```

**The rule:** `BillingService` is the only way into billing, and it talks only to
`BillingProvider`. A provider SDK type never appears in a signature outside
`providers/<name>/`.

### How Stripe is disabled

Three independent mechanisms, each of which must be undone deliberately:

1. **Never bound.** `BillingModule` registers exactly one adapter — the one
   `PAYMENT_PROVIDER` names. The dormant class is imported for its type but is
   not in the `providers` array, so Nest never constructs it.
2. **Never loaded.** `StripeProvider` imports the Stripe SDK with a dynamic
   `import()` inside its client getter and `import type` at module scope. With
   Stripe dormant the SDK is never read off disk — no HTTP agent, no key parsing,
   nothing in the running process.
3. **Refuses anyway.** Every entry point calls `assertActive()` first. Even if
   something reached in and constructed the class, it raises
   `BillingProviderDisabledError` rather than transacting. This is covered by
   `stripe.provider.spec.ts`.

### Data model

Billing tables store generic identifiers qualified by `provider`:

| Column                   | Notes                                                   |
| ------------------------ | ------------------------------------------------------- |
| `provider`               | `PADDLE` \| `STRIPE` — makes every row self-describing  |
| `providerCustomerId`     | Unique **per provider**, not globally                    |
| `providerSubscriptionId` | Unique per provider                                      |
| `providerPriceId`        | Whatever the active provider calls a price               |
| `billingInterval`        | `MONTH` \| `YEAR` — annual modelled, not yet sold        |

Two tables support correctness rather than features:

- **`invoices`** — payment history, synchronized by webhook, so the billing page
  renders from our database instead of an outbound call on every view.
- **`webhook_events`** — the idempotency ledger. See [Webhooks](#webhooks).

---

## Paddle setup

Do these in the Paddle dashboard before flipping `payments_enabled = true`.
Sandbox and production are entirely separate accounts; repeat for each.

### 1. Products and prices

**Catalog → Products.** Create two products and one recurring monthly price each:

| Product      | Price     | Env variable                        |
| ------------ | --------- | ----------------------------------- |
| Starter      | $299/mo   | `PADDLE_PRICE_STARTER_MONTHLY`      |
| Professional | $599/mo   | `PADDLE_PRICE_PROFESSIONAL_MONTHLY` |

Copy each `pri_…` ID into the matching variable.

> **Trials.** Paddle attaches a free trial to the **price**, not to the checkout,
> so `BILLING_TRIAL_PERIOD_DAYS` is ignored under Paddle (the API logs a warning
> if it is non-zero). Configure trials on the price itself.

Annual prices are optional. Leaving `PADDLE_PRICE_*_ANNUAL` empty means annual
billing is simply not offered — the API refuses a checkout for that interval
rather than inventing a price. Launching annual plans is: create the prices, set
the two variables, redeploy. No code change.

### 2. Default payment link — required

**Paddle → Checkout → Checkout settings → Default payment link:**

```
https://rooferslabs.com/checkout
```

This is **mandatory**, and it is the one piece of Paddle that has no equivalent
in Stripe. Paddle has no fully-hosted checkout page: the payment link must point
at a page *we* serve that runs Paddle.js, and Paddle appends the transaction as
`?_ptxn=txn_…`. `apps/web/src/pages/CheckoutPage.tsx` is that page.

It is also where Paddle sends customers from its own emails — "update your
payment method" and dunning notices for a failed charge — so it must exist even
though the in-app flow opens its checkout on `/payment` instead.

The domain must be **approved** in Paddle for the production account.

### 3. Notification destination (webhook)

**Paddle → Developer tools → Notifications → New destination:**

```
https://api.rooferslabs.com/v1/billing/webhook/paddle
```

Subscribe to exactly these events:

| Event                         | What it does                                |
| ----------------------------- | ------------------------------------------- |
| `subscription.created`        | First record of a subscription              |
| `subscription.activated`      | Grants access; provisions the AI number     |
| `subscription.updated`        | Plan changes, scheduled cancellations       |
| `subscription.canceled`       | Ends access at period end                   |
| `subscription.paused`         | Suspends access                             |
| `subscription.resumed`        | Restores access                             |
| `subscription.trialing`       | Trial started                               |
| `subscription.past_due`       | Payment failed; dunning has begun           |
| `transaction.completed`       | Payment succeeded → invoice synced          |
| `transaction.billed`          | Invoice issued                              |
| `transaction.payment_failed`  | Payment failed                              |
| `transaction.past_due`        | Invoice overdue                             |

Copy the destination's **secret key** (`pdl_ntfset_…`) into
`PADDLE_WEBHOOK_SECRET`. Anything not listed above is acknowledged and recorded
as `IGNORED` rather than retried.

### 4. API credentials

**Paddle → Developer tools → Authentication:**

- **API key** (`pdl_live_…` / `pdl_sdbx_…`) → `PADDLE_API_KEY`. Server only.
- **Client-side token** (`live_…` / `test_…`) → `PADDLE_CLIENT_TOKEN`.

The client token is publishable by design — it identifies the seller account and
can only open a checkout for a transaction the server already created and priced.
It is served to the browser from `GET /v1/billing/config` rather than baked into
the web bundle, so rotating it needs no rebuild.

---

## Environment variables

| Variable                            | Required             | Description                                        |
| ----------------------------------- | -------------------- | -------------------------------------------------- |
| `PAYMENTS_ENABLED`                  | no (default `true`)  | Master switch. `false` opens the wall entirely.     |
| `PAYMENT_PROVIDER`                  | no (default `paddle`)| `paddle` \| `stripe`. Unknown values fail boot.     |
| `PADDLE_API_KEY`                    | **prod†**            | Server-side key. Never exposed.                     |
| `PADDLE_CLIENT_TOKEN`               | **prod†**            | Browser token, served via `/v1/billing/config`.     |
| `PADDLE_WEBHOOK_SECRET`             | **prod†**            | Notification destination secret.                    |
| `PADDLE_ENVIRONMENT`                | no (default sandbox) | `sandbox` \| `production`.                          |
| `PADDLE_PRICE_STARTER_MONTHLY`      | **prod†**            | `pri_…`                                             |
| `PADDLE_PRICE_PROFESSIONAL_MONTHLY` | **prod†**            | `pri_…`                                             |
| `PADDLE_PRICE_STARTER_ANNUAL`       | no                   | Empty = annual not offered.                         |
| `PADDLE_PRICE_PROFESSIONAL_ANNUAL`  | no                   | Empty = annual not offered.                         |
| `BILLING_TRIAL_PERIOD_DAYS`         | no                   | Stripe only; Paddle sets trials on the price.       |
| `BILLING_GRANDFATHER_BEFORE`        | no                   | RFC3339; tenants created before it skip the wall.   |
| `STRIPE_*`                          | never                | Dormant. Boot succeeds with all of them empty.      |

† Required only in production while `PAYMENTS_ENABLED=true` **and**
`PAYMENT_PROVIDER=paddle`. Only the active provider's variables are ever
enforced — that is what lets the platform run with no Stripe account at all.

`PADDLE_ENVIRONMENT` treats anything other than the exact string `production` as
sandbox, so a typo bills nobody rather than charging real cards.

**Nothing is added to `apps/web/.env`.** The browser gets what it needs from the
API at runtime.

---

## Webhooks

Webhooks are the only path by which subscription state changes. Three properties
hold, in this order:

### 1. Authenticity

`PaddleProvider.verifyAndParseWebhook` calls the SDK's `webhooks.unmarshal`,
which recomputes HMAC-SHA256 over `timestamp:rawBody` using the destination
secret, compares in constant time, and enforces a timestamp tolerance that makes
a captured request useless to replay later. It throws on any failure and nothing
downstream runs on unverified bytes.

This requires the **raw** request body — `main.ts` sets `rawBody: true`. Any
re-serialization invalidates every signature.

### 2. Idempotency

Paddle guarantees *at-least-once* delivery: it retries after a timeout, a 5xx, or
a dropped connection, and events routinely arrive out of order. Handling one
twice would mean a duplicate invoice row or a second phone number purchased.

`WebhookEventRepository.claim()` **inserts** the provider's event id under a
unique constraint and lets the database reject the second writer. Two concurrent
deliveries of the same event cannot both proceed, however closely they race —
something a check-then-act could never guarantee.

- First delivery → claimed, processed, marked `PROCESSED`.
- Redelivery of a handled event → skipped, still answered `2xx` (a non-2xx would
  make Paddle retry something already done).
- A previous attempt that **failed** or died mid-handler → retried, attempts
  incremented.

Invoice sync is independently idempotent: it upserts on
`(provider, providerInvoiceId)`, so it holds even if the ledger were bypassed.

### 3. Honest acknowledgement

`2xx` tells Paddle to stop retrying, so it is returned only once the change is
durably stored.

| Situation                         | Response | Why                                            |
| --------------------------------- | -------- | ---------------------------------------------- |
| Bad signature / unparseable        | `400`    | Permanent — will never verify. Stops retries.  |
| Unrecognized event type           | `200`    | Not an error. Recorded `IGNORED`.              |
| Database down, provider read fails | `5xx`    | Transient — Paddle retries with its backoff.   |
| Applied successfully              | `200`    | Done.                                          |

A failed delivery keeps its row with the error and attempt count, so a delivery
Paddle eventually gives up on is visible rather than lost.

---

## Deployment

The pipeline is unchanged. Migrations apply automatically when the API container
starts (`docker/api-entrypoint.sh`), so shipping the API applies them.

```bash
# 1. Supply credentials (never commit them)
cd infra/terraform/envs/production
terraform apply \
  -var 'paddle_api_key=pdl_live_…' \
  -var 'paddle_client_token=live_…' \
  -var 'paddle_webhook_secret=pdl_ntfset_…' \
  -var 'paddle_price_starter_monthly=pri_…' \
  -var 'paddle_price_professional_monthly=pri_…' \
  -var 'payments_enabled=true'

# 2. Ship
infra/scripts/deploy.sh        # API
infra/scripts/deploy-web.sh    # web — the only correct way to build the SPA
```

`payments_enabled = true` without the active provider's credentials **fails
`terraform plan`**, so the wall can never be switched on without the means to
enforce it. The dormant provider's keys are never written to Secrets Manager —
the platform holds no credentials for a processor it is not using.

---

## Local development

```bash
# .env
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=paddle
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=pdl_sdbx_…
PADDLE_CLIENT_TOKEN=test_…
PADDLE_PRICE_STARTER_MONTHLY=pri_…
PADDLE_PRICE_PROFESSIONAL_MONTHLY=pri_…
```

Paddle cannot reach `localhost`, so expose the API to receive webhooks:

```bash
ngrok http 4000
# Sandbox → Notifications → destination:
#   https://<tunnel>/v1/billing/webhook/paddle
# Sandbox → Checkout settings → default payment link:
#   http://localhost:5173/checkout
```

Sandbox accepts Paddle's test cards. To develop without billing at all, set
`PAYMENTS_ENABLED=false`: no provider client, no webhook route, billing endpoints
answer `503`, and every tenant reaches the product.

---

## Re-enabling Stripe

No code changes. Stripe is preserved precisely so this is a configuration task.

1. `PAYMENT_PROVIDER=stripe` (Terraform: `payment_provider = "stripe"`).
2. Supply `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`,
   `STRIPE_PRICE_PROFESSIONAL`. Env validation now demands these and stops
   demanding the Paddle ones.
3. Point a Stripe webhook at `https://<api-origin>/v1/billing/webhook/stripe`
   (the route only exists while Stripe is selected), subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
4. Stripe Dashboard → Settings → Billing → Customer portal → activate.
5. Deploy.

**Existing Paddle subscribers are not migrated.** Their rows stay
`provider = PADDLE` and remain readable, but `BillingService` refuses to cancel
or change a subscription through a processor that did not mint its identifiers —
those ids mean nothing to Stripe. Such a tenant is told to start a new
subscription. Moving a live book of business between processors is a commercial
exercise (Paddle is a merchant of record; Stripe is not), not something this
switch attempts.

---

## Migration notes

Recorded for the Stripe → Paddle change, July 2026.

### Behavioural differences

| Concern         | Stripe                              | Paddle                                                |
| --------------- | ----------------------------------- | ----------------------------------------------------- |
| Checkout        | Server-created hosted session + URL | Server-created **transaction**; browser opens it       |
| Hosted page     | Fully hosted by Stripe              | **None** — you host the page running Paddle.js         |
| Success URL     | Baked into the session server-side  | Passed by the **browser** via Paddle.js `settings`      |
| Trials          | Per-checkout (`trial_period_days`)  | Per-**price**, in the dashboard                        |
| Cancellation    | `cancel_at_period_end` flag         | A `scheduledChange` object; status stays `active`      |
| Undo cancel     | Clear the flag                      | `PATCH` with `scheduledChange: null`                   |
| Invoices        | A distinct Invoice object           | A **transaction** is the billing document              |
| Statuses        | 8, incl. `incomplete` / `unpaid`    | 5 — no subscription exists before its first payment    |
| Merchant        | You are the merchant                | **Paddle is the merchant of record** (handles tax/VAT) |

`SubscriptionStatus` deliberately remains the union of both vocabularies, so
switching providers never needs a data migration.

### Database migration

`20260729120000_provider_agnostic_billing` renames rather than drops:

```sql
ALTER TABLE subscriptions RENAME COLUMN "stripeCustomerId" TO "providerCustomerId";
-- …plus subscriptionId and priceId
```

Existing rows are backfilled `provider = 'STRIPE'` (they were created by the
Stripe integration); the column default is then moved to `PADDLE` for new rows.
Data is preserved and the migration is instant — it rewrites catalog entries,
not rows. `prisma migrate diff` would have generated DROP + ADD, which discards
every billing row and fails outright on a non-empty table.

Also adds the `invoices` and `webhook_events` tables.

### Remaining before accepting live payments

1. Paddle account approved and the domain verified.
2. Products and prices created; the two `pri_…` IDs supplied.
3. Default payment link set to `https://rooferslabs.com/checkout`.
4. Notification destination created and its secret supplied.
5. `payments_enabled = true` applied.
6. End-to-end test in sandbox: subscribe → verify access → change plan →
   cancel → resume.
