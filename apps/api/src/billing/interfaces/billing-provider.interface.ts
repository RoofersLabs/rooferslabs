/**
 * The billing provider port.
 *
 * This is the seam the whole payment integration turns on. `BillingService`
 * depends on this interface and nothing else; each processor gets an adapter
 * behind it. Adding, swapping, or retiring a processor is therefore a matter of
 * writing an adapter and changing PAYMENT_PROVIDER — no controller, no service,
 * no repository, and no page changes.
 *
 * Two rules keep that promise honest:
 *
 *  1. Every method speaks the vocabulary in `../types/billing.types.ts`. A
 *     provider SDK type must never appear in this file's signatures.
 *  2. Exactly one implementation is bound at a time. The inactive one is still
 *     compiled and type-checked, so it cannot rot, but it is never constructed.
 */
import type { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import type {
  CheckoutHandle,
  CreateCheckoutInput,
  CreateCustomerInput,
  PlanChangeResult,
  PlanSelection,
  ProviderSubscription,
  ProviderWebhookEvent,
  WebhookRequest,
} from '../types/billing.types';

/**
 * DI token for the active provider.
 *
 * A token rather than a class so the binding is decided at module construction
 * from configuration, and so nothing can inject a concrete provider by name and
 * quietly bypass the abstraction.
 */
export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');

export interface BillingProvider {
  /** Which processor this is; stamped onto every row the adapter produces. */
  readonly provider: PaymentProvider;

  /**
   * Whether this adapter has everything it needs to make live calls. False
   * means credentials are missing, not that the provider is disabled — a
   * disabled provider throws from every method instead.
   */
  readonly isConfigured: boolean;

  // ── Customers ────────────────────────────────────────────────────────────

  /** Create the provider-side customer for a tenant; returns its id. */
  createCustomer(input: CreateCustomerInput): Promise<string>;

  /**
   * Whether a customer still exists provider-side. Guards against ids that
   * outlived the record they point at (deleted sandbox data, a reset account).
   * Implementations must answer `false` rather than throw on a lookup failure.
   */
  customerExists(customerId: string): Promise<boolean>;

  // ── Checkout & portal ────────────────────────────────────────────────────

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandle>;

  /**
   * A short-lived, authenticated link to the provider's hosted account area
   * (payment methods, invoices, cancellation). `subscriptionId` lets a provider
   * deep-link to the subscription rather than the portal home page.
   */
  createPortalSession(input: {
    customerId: string;
    subscriptionId: string | null;
    returnUrl: string;
  }): Promise<{ url: string }>;

  // ── Subscription lifecycle ───────────────────────────────────────────────

  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  /**
   * Move an existing subscription to a different plan.
   *
   * Proration is the adapter's decision, but the domain contract is fixed: an
   * upgrade takes effect immediately and is charged pro-rata, a downgrade takes
   * effect at the next renewal so the tenant keeps what it has already paid for.
   *
   * An adapter that cannot complete the change without the payer's consent says
   * so by returning an `approvalUrl` — see {@link PlanChangeResult}.
   */
  changePlan(input: {
    providerSubscriptionId: string;
    selection: PlanSelection;
    /** True when the target plan costs more than the current one. */
    isUpgrade: boolean;
    /** Where to return the browser if the provider needs an approval detour. */
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PlanChangeResult>;

  /**
   * Stop the subscription billing again while leaving the paid term intact.
   *
   * The domain contract is "no further charge, access until the period ends,
   * and reversible by {@link resumeSubscription} until it does". How an adapter
   * achieves that is its own business: Stripe sets a cancellation flag on the
   * period, PayPal — which has no scheduled cancellation and no way back from a
   * real cancel — suspends instead.
   */
  cancelAtPeriodEnd(providerSubscriptionId: string): Promise<ProviderSubscription>;

  /** Withdraw a scheduled cancellation while the subscription is still running. */
  resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;

  /**
   * End a subscription outright, with no way back.
   *
   * Called by the sweep that finalizes a cancel-at-period-end once the paid term
   * has actually lapsed — not by anything a tenant can reach directly.
   */
  cancelImmediately(providerSubscriptionId: string): Promise<void>;

  // ── Catalogue ────────────────────────────────────────────────────────────

  /**
   * The price identifier for a plan/interval, or throws when that combination is
   * not offered. This is how "annual is not launched yet" surfaces: the price
   * simply does not exist.
   *
   * Asynchronous because an adapter may resolve it from provisioned state rather
   * than from configuration — PayPal reads the catalogue its setup command
   * wrote — and that read must be allowed to refresh.
   */
  priceIdFor(selection: PlanSelection): Promise<string>;

  /** Reverse lookup, so an inbound webhook can label a subscription. */
  planForPriceId(priceId: string | null | undefined): {
    plan: SubscriptionPlan;
    interval: BillingInterval;
  } | null;

  // ── Webhooks ─────────────────────────────────────────────────────────────

  /**
   * Verify and normalize an inbound webhook.
   *
   * Implementations MUST reject anything that fails signature verification or
   * falls outside the replay window, by throwing. Returning normally is an
   * assertion that the payload genuinely came from the provider.
   */
  verifyAndParseWebhook(request: WebhookRequest): Promise<ProviderWebhookEvent>;
}
