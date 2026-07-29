/**
 * The provider-neutral billing vocabulary.
 *
 * Every type here is expressed in *our* terms, not a processor's. A provider
 * adapter's job is to translate its own API into these shapes and back; nothing
 * above the adapter boundary (BillingService, the repositories, the controllers,
 * the frontend) has ever heard of a Paddle transaction or a Stripe price.
 *
 * That is what makes swapping providers a configuration change: the domain sees
 * the same objects either way.
 */
import type {
  BillingInterval,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@rooferslabs/shared';

/** What a tenant is buying: a plan at a billing cadence. */
export interface PlanSelection {
  plan: SubscriptionPlan;
  interval: BillingInterval;
}

/** The tenant identity a provider needs to create its customer record. */
export interface CreateCustomerInput {
  companyId: string;
  companyName: string;
  /**
   * Required. Providers differ on whether they will accept a customer without
   * one (Paddle will not), so the domain resolves an address before it asks —
   * see BillingService.resolveBillingEmail.
   */
  email: string;
}

export interface CreateCheckoutInput {
  companyId: string;
  customerId: string;
  selection: PlanSelection;
  /** Where the provider should send the browser once payment succeeds. */
  successUrl: string;
  cancelUrl: string;
  /** Free-trial length in days; 0 disables the trial. */
  trialPeriodDays: number;
}

/**
 * A started checkout, in the two shapes providers actually offer.
 *
 * At least one of `url` and `transactionId` is always set:
 *
 *  - `url` — a page to navigate the browser to. Stripe's hosted Checkout works
 *    this way, and so does Paddle when a default payment link is configured.
 *  - `transactionId` — an opaque handle the provider's browser SDK opens an
 *    inline/overlay checkout for. This is Paddle's primary pattern.
 *
 * Returning both lets the client prefer the better experience (overlay, no
 * navigation away from the app) while keeping the redirect as a fallback that
 * works with JavaScript disabled or the SDK blocked.
 */
export interface CheckoutHandle {
  provider: PaymentProvider;
  url: string | null;
  transactionId: string | null;
}

/**
 * A subscription as the domain understands it, normalized from whatever the
 * provider returned.
 *
 * `companyId` is present when the provider echoed back the tenant reference we
 * attached at checkout. It is the primary way an inbound webhook is matched to
 * a tenant; the stored customer id is the fallback.
 */
export interface ProviderSubscription {
  provider: PaymentProvider;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerPriceId: string | null;
  companyId: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  interval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
}

/** A billing document, normalized. Amounts are in the currency's minor units. */
export interface ProviderInvoice {
  provider: PaymentProvider;
  providerInvoiceId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  amountDue: number;
  amountPaid: number;
  issuedAt: Date | null;
  paidAt: Date | null;
  /** Hosted invoice or receipt, when the provider exposes one. */
  invoiceUrl: string | null;
}

/**
 * What a webhook actually told us, reduced to the two facts the domain acts on:
 * a subscription changed, or a payment did.
 *
 * `id` is the provider's own event identifier and is the idempotency key — the
 * same delivery retried, or fanned out twice, carries the same id.
 */
export interface ProviderWebhookEvent {
  provider: PaymentProvider;
  id: string;
  type: string;
  occurredAt: Date;
  /**
   * The subscription this event describes, already normalized. Absent when the
   * event carries no subscription state (a standalone invoice, or an event type
   * we deliberately ignore).
   */
  subscription: ProviderSubscription | null;
  invoice: ProviderInvoice | null;
  /**
   * True when the provider sent something we have no handler for. Recorded and
   * acknowledged rather than retried — an unrecognized event is not a failure,
   * and answering 5xx would make the provider redeliver it forever.
   */
  ignored: boolean;
}

/** Raw request material a signature check needs, before anything is parsed. */
export interface WebhookRequest {
  /**
   * The untouched request bytes. Any re-serialization — even reordering
   * whitespace — invalidates the signature, so this must be the body exactly as
   * it arrived on the wire.
   */
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}
