# Billing

RoofersLabs bills through **PayPal Subscriptions** — the only implemented
processor. The provider-port architecture survives it: `BillingService` talks
to the `BillingProvider` interface alone, so a second processor is an adapter
plus a row in `PROVIDER_ADAPTERS`, never a service or page change.

- [Architecture](#architecture)
- [PayPal setup](#paypal-setup)
- [Environment variables](#environment-variables)
- [Test pricing](#test-pricing)
- [Startup validation](#startup-validation)
- [Webhooks](#webhooks)
- [Cancellation, and why it is a suspension](#cancellation-and-why-it-is-a-suspension)
- [Deployment](#deployment)
- [Local development](#local-development)
- [Adding a second provider](#adding-a-second-provider)
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
│   ├── subscription-sweep.service.ts   Finalizes lapsed cancellations (hourly)
│   └── webhook-processor.service.ts    Verify → deduplicate → apply
├── provisioning/                Setup, not a request path
│   ├── catalog.config.ts           WHAT WE SELL, as data — the only file to edit
│   ├── paypal-provisioning.service.ts  Idempotent: lookup-then-create
│   ├── billing-readiness.service.ts    "Can this deployment take money?"
│   ├── billing-catalog.repository.ts   Provisioned ids, scoped by environment
│   └── billing-provisioning.module.ts  Narrow module the setup command boots
├── repositories/
│   ├── billing.repository.ts    Subscription read-model
│   ├── invoice.repository.ts    Synchronized billing documents
│   └── webhook-event.repository.ts     The idempotency ledger
├── providers/
│   ├── paypal/                  ACTIVE — the only files importing the PayPal SDK
│   │   ├── paypal.client.ts        Transport: OAuth2, retries, base URL
│   │   ├── paypal.catalog.ts       Products & plans administration (setup only)
│   │   ├── paypal.webhooks-admin.ts  Webhook registration (setup only)
│   │   ├── paypal.plans.ts         Plan lookup, from the provisioned catalogue
│   │   ├── paypal.subscriptions.ts REST operations, no domain vocabulary
│   │   ├── paypal.webhook.ts       Signature verification
│   │   ├── paypal.mapper.ts        Wire → domain, pure and unit-testable
│   │   ├── paypal.types.ts         The shapes PayPal actually sends
│   │   └── paypal.provider.ts      The adapter implementing the port
└── webhooks/
    └── paypal-webhook.controller.ts
```

**The rule:** `BillingService` is the only way into billing, and it talks only to
`BillingProvider`. A provider SDK type never appears in a signature outside
`providers/<name>/`.

### Why the SDK is not used for everything

`@paypal/paypal-server-sdk` is the official SDK and owns the parts worth owning:
minting and refreshing the OAuth2 client-credentials token, retries, and
resolving the sandbox/live host. But its models are generated, and two things
this integration depends on are missing:

1. **`Subscription.status` is not modelled.** PayPal returns it on every
   subscription read; APIMATIC's mapper drops unmodelled keys rather than
   passing them through, so reading a subscription through
   `SubscriptionsController` yields an object with no status at all — the single
   field every state transition here turns on.
2. **Webhook verification has no controller** in the SDK whatsoever.

So subscription reads and webhook verification go through
`PayPalClient.request()`, which is still the SDK's own authenticated request
builder — same token, same retries, same host — but returns the untouched JSON.
This is not a workaround around the SDK; it is the SDK's own transport with our
own parsing.

### Data model

Billing tables store generic identifiers qualified by `provider`:

| Column                   | Notes                                                       |
| ------------------------ | ----------------------------------------------------------- |
| `provider`               | `PAYPAL` today — makes every row self-describing            |
| `providerCustomerId`     | Unique **per provider**, not globally                       |
| `providerSubscriptionId` | Unique per provider                                         |
| `providerPriceId`        | Whatever the active provider calls a price — a plan id here |
| `billingInterval`        | `MONTH` \| `YEAR` — annual modelled, not yet sold           |

**On `providerCustomerId` under PayPal.** PayPal has no customer object: there is
only a payer, and their id is not known until they have approved a subscription.
`createCustomer` therefore mints nothing and returns `local:<companyId>`, which
is replaced by the real payer id the moment PayPal reports one. The column is
only ever used to find the tenant's row again — never to call PayPal — so the
substitution is safe, and the provider-scoped unique index keeps it
collision-free.

Three tables support correctness rather than features:

- **`billing_catalog`** — what the provisioner created at PayPal: the product,
  each plan, and the webhook, keyed by `(provider, environment, key)`. This is
  what replaces the `PAYPAL_PLAN_*` environment variables. Scoped by environment
  because a sandbox plan id and a live one are different objects that must never
  be confused.
- **`invoices`** — payment history, synchronized by webhook, so the billing page
  renders from our database instead of an outbound call on every view.
- **`webhook_events`** — the idempotency ledger. See [Webhooks](#webhooks).

---

## PayPal setup

**One manual step, then one command.**

PayPal has no API for minting REST app credentials, so obtaining a Client ID and
Secret is the only thing you do by hand. Everything else — the product, the
billing plans, the webhook registration — is created by
`npm run billing:paypal:setup`, because PayPal exposes all of it over its API.

### 1. Credentials (the only manual step)

**Developer Dashboard → Apps & Credentials → Create App** (type: Merchant), on
the Sandbox or Live tab depending on which estate you are setting up. Copy the
**Client ID** and **Secret** into `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

Both are server-side only. Unlike a publishable key, neither ever reaches the
browser: PayPal's checkout is a redirect to an approval URL the API mints, so
the client needs no credential at all.

### 2. Run setup

```bash
npm run billing:paypal:setup
```

It will, in order:

| Step        | What it does                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials | Mints a token, then reads the catalogue to prove the app has the Subscriptions capability. Distinguishes "wrong credentials" from "missing permission". |
| Product     | Finds or creates **r1 Echo** (`SERVICE` / `SOFTWARE`).                                                                                                  |
| Plans       | Finds or creates every entry in `CATALOG_PLANS` — today, **Founding Customer**, $49.00/month, auto-renewing.                                            |
| Webhook     | Finds or registers a webhook at `<API_PUBLIC_URL>/v1/billing/webhook/paypal`, subscribed to the twelve events the integration handles.                  |
| Persist     | Writes each provider-issued id into `billing_catalog`.                                                                                                  |
| Validate    | Re-checks readiness and exits non-zero if billing still could not take a payment.                                                                       |

Output looks like:

```
────────────────────────────────────────────────────────────────────────
  PayPal provisioning — sandbox
  Webhook target: https://api.dev.rooferslabs.com/v1/billing/webhook/paypal
────────────────────────────────────────────────────────────────────────
  = credentials                  Authenticated against PayPal sandbox.
  + product                      Created product "r1 Echo" (RL-R1-ECHO-SBX).
  + plan:STARTER:MONTH           Created plan "Founding Customer" at 49.00 USD/month.
                                 id: P-5ML4271244454362WXNWU5NQ
  + webhook                      Registered webhook across 12 event types.
                                 id: 8PT597110X687430LKGECATA
────────────────────────────────────────────────────────────────────────

Billing readiness — paypal (sandbox): READY
```

`+` created, `=` reused, `~` updated, `!` skipped, `x` failed.

### Idempotency

Running it twice is a no-op — every line reports `=`. That holds at three
layers, so the run converges no matter where a previous one died:

1. **The persisted row.** An id we already recorded is verified to still exist
   and then left alone.
2. **PayPal itself.** With no row — a fresh database, a restored snapshot — the
   product is found by its deterministic id, the plan by name within the
   product, and the webhook by URL. Existing objects are **adopted**, never
   duplicated.
3. **`PayPal-Request-Id`.** Every create carries one, so a retry inside PayPal's
   72-hour window returns the original object rather than a second.

It never edits or deletes a plan. PayPal will not reprice a plan with live
subscriptions, and silently continuing to sell an old price is the surprise this
system exists to prevent — so drift is **reported** and you decide.

### Adding a plan

Add an entry to `apps/api/src/billing/provisioning/catalog.config.ts` and re-run
setup. No dashboard work, no environment variable, no code change anywhere else.

```ts
{
  key: 'professional-monthly',   // permanent — never change it once provisioned
  pricingMode: 'production',     // 'test' entries are the $1.00 twins
  plan: SubscriptionPlan.PROFESSIONAL,
  interval: BillingInterval.MONTH,
  name: 'Professional',
  description: 'r1 Echo — Professional plan, billed monthly.',
  amount: '149.00',
  currency: 'USD',
  autoRenew: true,
  paymentFailureThreshold: 3,
}
```

### Trials

A trial is a billing cycle on the plan with `tenure_type: "TRIAL"` and
`sequence: 1`, not a per-checkout option — so `BILLING_TRIAL_PERIOD_DAYS` is
ignored under PayPal and the API logs a warning if it is set to anything but
`0`.

### Local development

PayPal will not deliver to `localhost`. Setup detects this, provisions the
product and plans, and skips the webhook with an instruction rather than an
opaque PayPal error. To register one locally:

```bash
ngrok http 4000
# set API_PUBLIC_URL to the tunnel origin, then:
npm run billing:paypal:setup
```

---

## Environment variables

**Two.** That is the whole billing configuration.

| Variable                         | Required | Notes                                                       |
| -------------------------------- | -------- | ----------------------------------------------------------- |
| `PAYPAL_CLIENT_ID`               | **yes†** | Server-side only, never exposed                             |
| `PAYPAL_CLIENT_SECRET`           | **yes†** | Server-side only, never exposed                             |
| `PAYMENTS_ENABLED`               | no       | Default `true`. `false` opens the wall entirely             |
| `PAYMENT_PROVIDER`               | no       | Default `paypal`; the only supported provider               |
| `PAYPAL_ENVIRONMENT`             | no       | `sandbox` (default) \| `live`                               |
| `PAYPAL_WEBHOOK_ID`              | no       | Override only. Setup registers a webhook and records its id |
| `PAYPAL_TEST_PRICING`            | no       | Default `false`. `true` charges the token test price — see below |
| `BILLING_TRIAL_PERIOD_DAYS`      | no       | Ignored with a warning — PayPal sets trials on the plan     |
| `BILLING_GRANDFATHER_BEFORE`     | no       | Tenants created before this instant skip the wall           |

† Required in a **deployed** environment while `PAYMENTS_ENABLED=true`.

The client id is additionally served to the browser through
`GET /v1/billing/config` — it is PayPal's publishable identifier, needed to load
the JS SDK for the in-context buttons, and cannot move money on its own. The
secret never leaves the server.

**There is no plan id, product id or webhook id here.** They are provisioned by
`billing:paypal:setup` and read from `billing_catalog`. Env validation therefore
cannot tell you whether billing actually works — that is
[startup validation](#startup-validation)'s job.

## Startup validation

Environment validation proves the _credentials_ are present. Billing readiness
proves the _catalogue was provisioned_ — a different question, and the one a
customer's checkout depends on.

`BillingReadinessService` is the single implementation, used in three places:

| Caller                   | Behaviour                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Boot (`main.ts`)         | A **deployed** environment with payments on and billing unprovisioned **refuses to start** and exits 1. Locally it warns. |
| `GET /v1/health/billing` | Returns each check and its remedy. Redacted: names and remedies, never identifiers.                                       |
| `billing:paypal:setup`   | Closing validation, so the exit code answers "can this take money?" not "did the API calls return 200?".                  |

Refusing to start is deliberate. A deployed API with the wall up and no
catalogue would accept signups, walk them through onboarding, and fail every
checkout with a 500. Failing the deployment instead means the previous task
keeps serving and the log says exactly what to run.

```
Billing readiness — paypal (live): NOT READY
  ✓ credentials-present
  ✓ product-provisioned
  ✗ plan-provisioned:plan:STARTER:MONTH — Plan "Founding Customer" is not provisioned. Run `npm run billing:paypal:setup`.
  ✓ webhook-registered
```

## Test pricing

`PAYPAL_TEST_PRICING=true` charges the provisioned **$1.00** plan instead of the
published **$49.00** one, so a live payment pipeline can be proven end to end —
real credentials, real webhook signature verification, real money arriving in the
bank — without taking a full subscription fee to do it.

**What changes:** the plan id a checkout is created against. That is the whole
list.

**What does not change:** the marketing site, the pricing page, the payment page,
the billing page and every piece of customer-facing copy still say $49/month.
Activation, webhooks, entitlement, redirect, cancellation and subscription state
are byte-for-byte identical. The customer sees $1.00 for the first time on
PayPal's own approval page, where the plan is named _"Founding Customer (test
pricing)"_.

The $1.00 plan is a **separate PayPal plan**, created by
`billing:paypal:setup` alongside the $49.00 one. The published plan is never
modified — PayPal cannot reprice a plan with live subscriptions, so "make a test
price" can only ever mean "make another plan".

|                                 | `false` (default)    | `true`              |
| ------------------------------- | -------------------- | ------------------- |
| Checkout charges                | $49.00               | **$1.00**           |
| Site displays                   | $49/month            | $49/month           |
| Domain plan                     | `STARTER` / `MONTH`  | `STARTER` / `MONTH` |
| Entitlement, webhooks, redirect | unchanged            | unchanged           |
| Boot log                        | quiet                | error-level warning |
| `/v1/health/billing`            | `testPricing: false` | `testPricing: true` |

Scoped to the Founding Customer monthly plan only. A forgotten flag should cost
one plan's revenue, not the whole catalogue's, so it never applies to annual or
Professional even once those are provisioned.

**Two things to know before enabling it against a live account:**

- Subscriptions created while it is on **keep billing $1.00 on renewal**.
  Turning it off changes what _new_ checkouts charge, not what existing
  subscriptions bill — moving those is a plan revision per subscription. Cancel
  your test subscriptions rather than leaving them to renew.
- If the flag is on and the test plan is not provisioned, the checkout
  **refuses** rather than falling back to $49.00. Silently charging a customer
  49× what you intended during a test is not a safe default.

Turning it off requires only the environment variable and a redeploy — no code
change, no re-provisioning, no database change.

---

## Webhooks

Webhooks are the only path by which subscription state changes. Three properties
hold, in this order:

### 1. Authenticity

PayPal does not sign with a shared secret. A delivery carries a signature made
with a PayPal-held certificate, and the only supported way to check it is to POST
the transmission headers and the raw body back to
`/v1/notifications/verify-webhook-signature` along with the webhook id, and ask.

That is an outbound API call on the inbound path, and it has one consequence
worth stating plainly: **a failed verification call is not a failed signature.**
A network blip is not a forgery. The two are separate outcomes —

- signature rejected → `WebhookVerificationError` → `400`, permanent, stop retrying
- verification call failed → `ExternalServiceError` → `5xx`, transient, retry

Conflating them would eventually classify a PayPal outage as a forgery and
discard real subscription changes. The controller matches on the error **type**,
never on a message substring, for exactly this reason.

This requires the **raw** request body — `main.ts` sets `rawBody: true`. Any
re-serialization invalidates every signature.

### 2. Idempotency

PayPal guarantees _at-least-once_ delivery: it retries after a timeout, a 5xx, or
a dropped connection, and events routinely arrive out of order. Handling one
twice would mean a duplicate invoice row or a second phone number purchased.

`WebhookEventRepository.claim()` **inserts** the provider's event id under a
unique constraint and lets the database reject the second writer. Two concurrent
deliveries of the same event cannot both proceed, however closely they race —
something a check-then-act could never guarantee.

- First delivery → claimed, processed, marked `PROCESSED`.
- Redelivery of a handled event → skipped, still answered `2xx` (a non-2xx would
  make PayPal retry something already done).
- A previous attempt that **failed** or died mid-handler → retried, attempts
  incremented.

Invoice sync is independently idempotent: it upserts on
`(provider, providerInvoiceId)`, so it holds even if the ledger were bypassed.

### 3. Honest acknowledgement

`2xx` tells PayPal to stop retrying, so it is returned only once the change is
durably stored.

| Situation                         | Response | Why                                               |
| --------------------------------- | -------- | ------------------------------------------------- |
| Signature rejected / unparseable  | `400`    | Permanent — will never verify. Stops retries.     |
| Missing transmission headers      | `400`    | Cannot possibly verify. PayPal is not even asked. |
| Unrecognized event type           | `200`    | Not an error. Recorded `IGNORED`.                 |
| Verification call failed, DB down | `5xx`    | Transient — PayPal retries with its backoff.      |
| Applied successfully              | `200`    | Done.                                             |

A failed delivery keeps its row with the error and attempt count, so a delivery
PayPal eventually gives up on is visible rather than lost.

---

## Cancellation, and why it is a suspension

This is the one place PayPal's model and the product's rules genuinely disagree,
so it is worth understanding before changing anything here.

The product promises: **cancel now, keep access until the term you paid for
ends, and change your mind until it does.**

PayPal offers no scheduled cancellation, and its `cancel` is immediate _and_
irreversible. Suspending is the only operation that stops money moving while
remaining reinstatable. So:

| Action                     | What happens at PayPal | What happens locally                         |
| -------------------------- | ---------------------- | -------------------------------------------- |
| Cancel                     | `POST …/suspend`       | `cancelAtPeriodEnd = true`, status unchanged |
| Resume                     | `POST …/activate`      | `cancelAtPeriodEnd = false`                  |
| Term lapses (hourly sweep) | `POST …/cancel`        | status → `CANCELED`                          |

Two pieces of machinery make that safe:

**`BillingService.reconcilePendingCancellation`** — a suspension is
indistinguishable on the wire from one PayPal imposed after repeated payment
failures. The local `cancelAtPeriodEnd` flag is what disambiguates them: a paused
subscription we know is cancelling, whose paid term has not elapsed, keeps its
status. One we did _not_ cancel stays paused and loses access, which is correct —
that tenant stopped paying. Covered exhaustively by
`services/pending-cancellation.spec.ts`.

**`SubscriptionSweepService`** — hourly, the only timer in billing. Everything
else is webhook-driven, because a provider telling us what happened is better
evidence than a clock; this is the exception because nothing happens at PayPal
when a suspended subscription's term quietly expires. It is idempotent, guards
against overlapping runs, never rethrows, and recovers from any amount of
downtime by finding more rows on the next pass.

---

## Deployment

The pipeline is unchanged. Migrations apply automatically when the API container
starts (`docker/api-entrypoint.sh`), so shipping the API applies them.

```bash
# 1. Supply the two credentials (never commit them — production reads
#    paypal.auto.tfvars, which is gitignored), then apply.
cd infra/terraform/envs/production
terraform apply

# 2. Provision the catalogue. Idempotent — safe to run on every deploy.
npm run billing:paypal:setup

# 3. Ship
infra/scripts/deploy.sh        # API
infra/scripts/deploy-web.sh    # web — the only correct way to build the SPA
```

Step 2 can go in the deploy pipeline: it exits 0 when billing is ready and
non-zero with a diagnosis otherwise, and running it on an already-provisioned
environment changes nothing.

Order matters on a **first** launch. The API refuses to start with payments on
and no catalogue, so either run setup before enabling the wall, or enable the
wall and run setup before the API is redeployed. The safe sequence for a cold
start is: apply with `payments_enabled = false`, run setup, flip the flag, apply
again.

`payments_enabled = true` without the active provider's credentials **fails
`terraform plan`**, so the wall can never be switched on without the means to
enforce it. The dormant provider's keys are never written to Secrets Manager —
the platform holds no credentials for a processor it is not using.

---

## Local development

```bash
# .env — this is the whole of it
PAYMENTS_ENABLED=true
PAYMENT_PROVIDER=paypal
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_CLIENT_ID=AeA1QIZ…
PAYPAL_CLIENT_SECRET=EGnHDxD…
```

```bash
# PayPal cannot reach localhost, so tunnel before provisioning the webhook.
ngrok http 4000
# set API_PUBLIC_URL to the tunnel origin, then:
npm run billing:paypal:setup
```

Without a tunnel, setup still creates the product and plans and skips the webhook
with an explanation — enough to exercise checkout, though nothing will activate
until a webhook can reach you.

Approve checkouts with a **sandbox personal account** (Testing Tools → Sandbox
Accounts), not a real PayPal login. To develop without billing at all, set
`PAYMENTS_ENABLED=false`: no provider client, no webhook route, no sweep, billing
endpoints answer `503`, and every tenant reaches the product.

---

## Adding a second provider

PayPal is the only implemented processor. The port keeps a second one cheap:

1. Add the member to `PaymentProvider` (shared enums + Prisma schema — the
   compiler then demands the rest).
2. Write an adapter implementing `BillingProvider` under
   `providers/<name>/`, with its own webhook controller. No provider SDK type
   may appear in a signature outside that directory.
3. Add the row to `PROVIDER_ADAPTERS` and the credential list to
   `PROVIDER_REQUIRED_ENV`.
4. Select it with `PAYMENT_PROVIDER` and deploy.

**Existing PayPal subscribers would not be migrated by such a switch.** Their
rows stay `provider = PAYPAL` and remain readable, but `BillingService` refuses
to cancel or change a subscription through a processor that did not mint its
identifiers. Such a tenant is told to start a new subscription. Moving a live
book of business between processors is a commercial exercise, not something the
switch attempts.

---

## Migration notes

Recorded for the Paddle → PayPal change, August 2026. (The Stripe → Paddle change
of July 2026 is superseded; Paddle is gone from the codebase entirely.)

### Behavioural differences

| Concern      | Paddle (removed)                            | PayPal (current)                                   |
| ------------ | ------------------------------------------- | -------------------------------------------------- |
| Checkout     | Transaction id; browser opens an overlay    | **Redirect** to a PayPal approval URL              |
| Hosted page  | You host a page running Paddle.js           | PayPal hosts it; `/checkout` route deleted         |
| Browser SDK  | `@paddle/paddle-js` + a client token        | **None.** No credential reaches the browser        |
| Customer     | A real customer object, created upfront     | **No customer object**; payer id after approval    |
| Catalogue    | Prices (`pri_…`)                            | Billing plans (`P-…`) under a product              |
| Trials       | Per-price, in the dashboard                 | A billing cycle on the plan (`tenure_type: TRIAL`) |
| Cancellation | `scheduledChange`, status stays `active`    | **Suspend now, cancel on the sweep**               |
| Undo cancel  | `PATCH scheduledChange: null`               | `POST …/activate`                                  |
| Plan change  | Server-side, always                         | May need **payer approval** → `approvalUrl`        |
| Invoices     | A transaction is the billing document       | A `PAYMENT.SALE.*` is                              |
| Webhook auth | Local HMAC over `timestamp:rawBody`         | **API round-trip** to PayPal to verify             |
| Portal       | Hosted, per-merchant, minted per request    | None — PayPal's generic autopay page               |
| Merchant     | **Paddle was merchant of record** (tax/VAT) | **You are the merchant.** See below                |

`SubscriptionStatus` deliberately remains the union of every provider's
vocabulary, so switching providers never needs a data migration.

### ⚠️ Merchant of record

Paddle was a _merchant of record_: it was the legal seller, and collected and
remitted sales tax and VAT on RoofersLabs' behalf. **PayPal is not.** It is a
payment processor only.

RoofersLabs is now the seller of record and owns its own tax registration,
collection and remittance in every jurisdiction it sells into. Nothing in this
codebase calculates or collects tax, and the Terms deliberately do not publish
payment terms yet. This is a commercial and accounting obligation, not an
engineering one, and it is the single largest non-code consequence of this
migration.

The Privacy and Refund pages were rewritten accordingly: PayPal is named as a
processor, not as merchant of record, and refunds are described as issued by us
through PayPal rather than by the provider.

### Database migration

`20260801120000_paypal_payment_provider` rebuilds the `PaymentProvider` enum:
`PADDLE` is removed, `PAYPAL` added. Postgres cannot drop an enum value in place,
so the type is recreated and every dependent column re-typed.

It is **destructive by design and says so out loud**: rows stamped `PADDLE` name
identifiers that exist only in Paddle and resolve to nothing in PayPal, and there
is no honest value to convert them to. `subscriptions`, `invoices` and
`webhook_events` rows for that provider are deleted, and the counts are raised
into the deploy log with `RAISE NOTICE` so the removal is a recorded fact rather
than a silent one.

Verify what will be removed before deploying:

```sql
SELECT provider, count(*) FROM subscriptions GROUP BY provider;
```

### Remaining before accepting live payments

1. PayPal **business** account, verified, with Subscriptions enabled.
2. Live REST app created; client id and secret supplied.
3. Product and plans created live; the two `P-…` ids supplied.
4. Live webhook registered and its ID supplied.
5. `paypal_environment = "live"` and `payments_enabled = true` applied.
6. Sales-tax position resolved — see the merchant-of-record note above.
7. End-to-end test in sandbox: subscribe → verify access → change plan →
   cancel → confirm access persists → resume → let a term lapse and confirm the
   sweep cancels it.
