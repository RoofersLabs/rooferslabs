# 14 — Billing & Subscription Gating

Stripe subscription billing for RoofersLabs. A tenant may create an account and
an organization for free; **everything else requires an active subscription**.

---

## 1. Flow

```
Create account → Authenticate (Clerk) → Create organization → Payment
      → Stripe Checkout → webhook activates subscription → Dashboard
```

| Stage                      | Auth | Organization | Subscription | Dashboard | Protected APIs |
| -------------------------- | ---- | ------------ | ------------ | --------- | -------------- |
| Signed up, no organization | ✅   | —            | —            | ❌        | ❌             |
| Organization, not paid     | ✅   | ✅           | ❌           | ❌        | ❌ (402)       |
| Checkout completed         | ✅   | ✅           | ✅           | ✅        | ✅             |
| Payment failed / cancelled | ✅   | ✅           | ❌           | ❌        | ❌ (402)       |

Access is never revoked by deleting anything. A lapsed tenant keeps all of its
calls, customers, appointments, and knowledge base; it simply cannot read or
write them until billing is resolved.

---

## 2. Data model

`subscriptions` is a **read-model mirrored from Stripe** (`apps/api/prisma/schema.prisma`),
one row per company. Stripe is the source of truth; this table exists so that
request-time authorization never depends on an outbound API call.

| Column                                     | Purpose                                     |
| ------------------------------------------ | ------------------------------------------- |
| `companyId` (unique)                       | The tenant this billing account belongs to  |
| `stripeCustomerId` (unique)                | Stripe customer, created on first checkout  |
| `stripeSubscriptionId` (unique, nullable)  | Set once a subscription exists              |
| `stripePriceId`, `plan`                    | Which plan is active                        |
| `status`                                   | `SubscriptionStatus` (mirrors Stripe)       |
| `currentPeriodEnd`                         | End of the paid term                        |
| `cancelAtPeriodEnd`, `canceledAt`          | Pending / completed cancellation            |
| `trialEndsAt`                              | Trial expiry, when trials are enabled       |
| `createdAt`, `updatedAt`                   | Audit timestamps                            |

Only `ACTIVE` and `TRIALING` grant access (`ACTIVE_SUBSCRIPTION_STATUSES` in
`@rooferslabs/shared`). `PAST_DUE`, `UNPAID`, `CANCELED`, `INCOMPLETE`,
`INCOMPLETE_EXPIRED`, `PAUSED`, and `NONE` all block.

The migration (`20260723015112_subscriptions`) is purely additive: one table and
two enums. No existing column or row is touched.

---

## 3. Enforcement

`SubscriptionGuard` (`apps/api/src/auth/guards/subscription.guard.ts`) is a global
guard, ordered **after** authentication and tenant resolution and **before** roles:

```
ClerkAuthGuard → ThrottlerGuard → TenantGuard → SubscriptionGuard → RolesGuard
```

A blocked request gets **HTTP 402** with the stable code `SUBSCRIPTION_REQUIRED`.
The web client turns any 402 into a redirect to `/payment`; the route guard in
`App.tsx` does the same from the session payload. The client-side check is a
convenience — the guard is the enforcement point.

Endpoints reachable **without** a subscription:

| Endpoint                   | Exempted by                   | Why                          |
| -------------------------- | ----------------------------- | ---------------------------- |
| `GET /v1/auth/me`          | `@AllowNoCompany`             | Bootstraps the session       |
| `POST /v1/companies`       | `@AllowNoCompany`             | Organization creation        |
| `/v1/billing/*`            | `@AllowInactiveSubscription`  | Where a tenant goes to pay   |
| `/v1/billing/webhook`      | `@Public`                     | Stripe cannot present a token |
| `/v1/health*`              | `@Public`                     | Load balancer probes         |
| `/v1/telephony/incoming`…  | `@Public`                     | Twilio webhooks              |

Entitlement is cached in Redis for 60s per tenant and invalidated explicitly on
every state change, so the payment wall costs one Redis read per request.

---

## 4. API

| Method | Path                             | Purpose                             | Roles         |
| ------ | -------------------------------- | ----------------------------------- | ------------- |
| GET    | `/v1/billing/subscription`       | Current subscription state          | any member    |
| POST   | `/v1/billing/checkout-session`   | Start Checkout for a plan           | OWNER, ADMIN  |
| POST   | `/v1/billing/portal-session`     | Open the Customer Portal            | OWNER, ADMIN  |
| POST   | `/v1/billing/subscription/cancel`| Cancel at period end                | OWNER         |
| POST   | `/v1/billing/subscription/resume`| Undo a pending cancellation         | OWNER         |
| POST   | `/v1/billing/webhook`            | Stripe events (signature-verified)  | public        |

All responses use the standard envelope from `docs/09_API_Standards.md`.

---

## 5. Webhooks

`POST /v1/billing/webhook` verifies every payload against `STRIPE_WEBHOOK_SECRET`
using the **raw** request body (`rawBody: true` in `main.ts`) before parsing it.
An invalid signature is rejected with 400 and never reaches the database.

Handled events:

| Event                           | Effect                                            |
| ------------------------------- | ------------------------------------------------- |
| `checkout.session.completed`    | Fetches the subscription and activates the tenant |
| `customer.subscription.created` | Mirrors the new subscription                      |
| `customer.subscription.updated` | Mirrors status, plan, period, pending cancellation |
| `customer.subscription.deleted` | Marks `CANCELED` — access stops, data is kept     |
| `invoice.paid`                  | Re-reads the subscription (restores access)       |
| `invoice.payment_failed`        | Re-reads the subscription (usually `PAST_DUE`)    |

Handlers are idempotent and order-independent: each one re-reads the subscription
from Stripe and upserts the result, so a retried or out-of-order delivery
converges on the same state. Processing failures return 5xx so Stripe retries.

The tenant is resolved from the Stripe customer id, falling back to
`subscription.metadata.companyId` (set at checkout) and then the Checkout
session's `client_reference_id`. An event that matches no tenant is logged and
ignored rather than applied to the wrong company.

> **API version.** The Stripe client is pinned to `2025-08-27.basil`. In that
> version the billing period lives on the subscription **item**
> (`items.data[0].current_period_end`) and an invoice's subscription hangs off
> `invoice.parent.subscription_details`. Both are handled in `billing.service.ts`.

---

## 6. Failure handling

| Situation           | Stripe status        | Behaviour                                            |
| ------------------- | -------------------- | ---------------------------------------------------- |
| Card declined       | `past_due`           | Access blocked; portal link to update payment method |
| Invoice unpaid      | `unpaid`             | Access blocked; portal link to settle                |
| Checkout abandoned  | `incomplete`         | Access blocked; tenant can start checkout again      |
| Cancelled by owner  | `active` → `canceled` | Access continues to `currentPeriodEnd`, then blocked |
| Subscription paused | `paused`             | Access blocked                                       |

No customer data is ever deleted in response to a billing event.

---

## 7. Configuration

See the README's [Billing (Stripe)](../README.md#billing-stripe) section for the
Stripe Dashboard setup and the environment variables. `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, and `STRIPE_PRICE_PROFESSIONAL`
are **required in production** and validated at boot (`env.validation.ts`) — the
API refuses to start without them, because a production process without billing
configuration would lock every customer out.

---

## 8. Known gap

The AI receptionist answers inbound calls through public Twilio webhooks, which
are outside the subscription guard. A tenant that lapses **after** its phone
number was provisioned keeps receiving AI-answered calls until the number is
released. New tenants are unaffected (a number is only provisioned after payment,
at the end of onboarding). Gating telephony on entitlement is a deliberate
follow-up decision, not an oversight.
