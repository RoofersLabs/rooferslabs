/**
 * The provider-neutral billing vocabulary.
 *
 * Every type here is expressed in *our* terms, not a processor's. A provider
 * adapter's job is to translate its own API into these shapes and back; nothing
 * above the adapter boundary (BillingService, the repositories, the controllers,
 * the frontend) has ever heard of a PayPal plan or a Stripe price.
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
   * one, so the domain resolves an address before it asks — see
   * BillingService.resolveBillingEmail.
   */
  email: string;
}

export interface CreateCheckoutInput {
  companyId: string;
  customerId: string;
  /**
   * The tenant's name and billing address, carried on the checkout itself.
   *
   * Present because not every provider has a customer object to have stored
   * them against beforehand: PayPal identifies the subscriber inline at
   * subscription creation, so the details have to travel with the checkout
   * rather than having been registered by `createCustomer`.
   */
  companyName: string;
  email: string;
  selection: PlanSelection;
  /** Where the provider should send the browser once payment succeeds. */
  successUrl: string;
  cancelUrl: string;
  /** Free-trial length in days; 0 disables the trial. */
  trialPeriodDays: number;
}

/**
 * A started checkout: somewhere to send the browser.
 *
 * Both supported processors are redirect-based — PayPal returns an approval
 * link the payer must visit to consent to the subscription, Stripe returns its
 * hosted Checkout session — so the handle is deliberately just a destination.
 * The client navigates; it never assembles a payment UI of its own, and no
 * secret is ever needed in the browser to complete one.
 */
export interface CheckoutHandle {
  provider: PaymentProvider;
  /** The page to navigate to. Never null: a checkout that produced no URL failed. */
  url: string;
  /**
   * Where the provider will return the browser once payment succeeds.
   *
   * Carried on the handle because the server decides it, not the client — it is
   * baked into the provider-side session or subscription at creation. Returned
   * so the frontend can recognize its own return trip.
   */
  successUrl: string;
}

/**
 * The outcome of moving a subscription to a different plan.
 *
 * `approvalUrl` exists because PayPal cannot always complete a plan change
 * server-side: raising what a payer is billed requires their consent, and PayPal
 * answers a revision with a link the browser must visit. Until it is followed
 * the subscription stays on its old plan.
 *
 * Null for a change that took effect immediately — every Stripe change, and a
 * PayPal downgrade.
 */
export interface PlanChangeResult {
  subscription: ProviderSubscription;
  approvalUrl: string | null;
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
