import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import {
  BillingInterval,
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@rooferslabs/shared';
import {
  BillingProviderDisabledError,
  BillingProviderUnconfiguredError,
  ExternalServiceError,
} from '../../../common/exceptions/domain.exception';
import { AppConfigService } from '../../../config/app-config.service';
import type { PriceTable } from '../../../config/configuration';
import type { BillingProvider } from '../../interfaces/billing-provider.interface';
import type {
  CheckoutHandle,
  CreateCheckoutInput,
  CreateCustomerInput,
  PlanSelection,
  ProviderInvoice,
  ProviderSubscription,
  ProviderWebhookEvent,
  WebhookRequest,
} from '../../types/billing.types';
import {
  subscriptionIdFromInvoice,
  toProviderInvoice,
  toProviderSubscription,
} from './stripe.mapper';

/**
 * The Stripe adapter — complete, compile-checked, and dormant.
 *
 * Stripe is preserved rather than deleted so the platform can move back to it
 * without rewriting the integration. It is inert in three independent ways, and
 * every one of them has to be undone deliberately:
 *
 *  1. **Never bound.** BillingModule binds BILLING_PROVIDER to exactly one
 *     adapter, chosen by PAYMENT_PROVIDER. While that says `paddle`, this class
 *     is never constructed and nothing holds a reference to it.
 *  2. **Never loaded.** The Stripe SDK is pulled in with a dynamic `import()`
 *     inside the client getter, and only `import type` at the top of the file.
 *     With Stripe dormant the module is never even read off disk, so it
 *     contributes nothing to startup — no HTTP agent, no key parsing.
 *  3. **Refuses anyway.** Every entry point calls {@link assertActive} first.
 *     Even if something reached in and constructed this class, it would raise
 *     `BillingProviderDisabledError` rather than transact.
 *
 * Re-enabling is therefore: set PAYMENT_PROVIDER=stripe, supply the STRIPE_*
 * variables, point the webhook at /v1/billing/webhook/stripe. No code changes.
 * See docs/billing.md for the full checklist.
 */
@Injectable()
export class StripeProvider implements BillingProvider {
  readonly provider = PaymentProvider.STRIPE;

  private readonly logger = new Logger(StripeProvider.name);
  private client: Stripe | null = null;

  constructor(private readonly config: AppConfigService) {}

  /** Whether Stripe is the processor the platform is currently billing through. */
  private get isActive(): boolean {
    return this.config.payments.provider === PaymentProvider.STRIPE;
  }

  get isConfigured(): boolean {
    return this.isActive && Boolean(this.config.stripe.secretKey);
  }

  /**
   * The guard that makes dormancy enforced rather than merely intended. Called
   * by every public method before it can reach the network.
   */
  private assertActive(): void {
    if (!this.isActive) {
      throw new BillingProviderDisabledError(PaymentProvider.STRIPE);
    }
  }

  /**
   * The Stripe client.
   *
   * The SDK is loaded here, on first use, rather than imported at module scope.
   * That is what keeps a dormant Stripe genuinely absent from the running
   * process instead of merely unused.
   */
  private async stripe(): Promise<Stripe> {
    this.assertActive();
    if (!this.config.stripe.secretKey) {
      throw new BillingProviderUnconfiguredError(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing.',
      );
    }
    if (!this.client) {
      const { default: StripeSdk } = await import('stripe');
      this.client = new StripeSdk(this.config.stripe.secretKey, {
        // Pin the API version: an account-level upgrade must never silently
        // change payload shapes under a running deployment.
        apiVersion: '2025-08-27.basil',
        typescript: true,
        appInfo: { name: 'rooferslabs', version: '1.0.0' },
        maxNetworkRetries: 2,
      });
    }
    return this.client;
  }

  private get prices(): PriceTable {
    return this.config.stripe.prices;
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  priceIdFor(selection: PlanSelection): string {
    const priceId = this.prices[selection.plan]?.[selection.interval];
    if (!priceId) {
      throw new ExternalServiceError(
        `No Stripe price is configured for the ${selection.plan} plan billed ${selection.interval.toLowerCase()}ly.`,
      );
    }
    return priceId;
  }

  planForPriceId(
    priceId: string | null | undefined,
  ): { plan: SubscriptionPlan; interval: BillingInterval } | null {
    if (!priceId) return null;
    for (const [plan, intervals] of Object.entries(this.prices)) {
      for (const [interval, id] of Object.entries(intervals)) {
        if (id && id === priceId) {
          return { plan: plan as SubscriptionPlan, interval: interval as BillingInterval };
        }
      }
    }
    return null;
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const stripe = await this.stripe();
    const customer = await stripe.customers.create({
      name: input.companyName,
      email: input.email,
      metadata: { companyId: input.companyId },
    });
    this.logger.log(`Created Stripe customer ${customer.id} for company ${input.companyId}`);
    return customer.id;
  }

  async customerExists(customerId: string): Promise<boolean> {
    try {
      const stripe = await this.stripe();
      const customer = await stripe.customers.retrieve(customerId);
      return !customer.deleted;
    } catch {
      return false;
    }
  }

  // ── Checkout & portal ────────────────────────────────────────────────────

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandle> {
    const stripe = await this.stripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: this.priceIdFor(input.selection), quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: input.companyId,
      // Metadata is mirrored onto the subscription so every webhook — including
      // ones that arrive without the session — can resolve the tenant.
      metadata: { companyId: input.companyId },
      subscription_data: {
        metadata: { companyId: input.companyId },
        ...(input.trialPeriodDays > 0 ? { trial_period_days: input.trialPeriodDays } : {}),
      },
    });

    if (!session.url) {
      throw new ExternalServiceError('Stripe did not return a checkout URL.');
    }
    // Stripe's Checkout is a hosted page, so there is no client-side handle —
    // and the success URL was already baked into the session above.
    return {
      provider: this.provider,
      url: session.url,
      transactionId: null,
      successUrl: input.successUrl,
    };
  }

  async createPortalSession(input: {
    customerId: string;
    subscriptionId: string | null;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const stripe = await this.stripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  // ── Subscription lifecycle ───────────────────────────────────────────────

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const stripe = await this.stripe();
    return this.normalize(await stripe.subscriptions.retrieve(providerSubscriptionId));
  }

  async changePlan(input: {
    providerSubscriptionId: string;
    selection: PlanSelection;
    isUpgrade: boolean;
  }): Promise<ProviderSubscription> {
    const stripe = await this.stripe();
    const current = await stripe.subscriptions.retrieve(input.providerSubscriptionId);
    const item = current.items.data[0];
    if (!item) {
      throw new ExternalServiceError('This subscription has no billable item to change.');
    }

    const updated = await stripe.subscriptions.update(input.providerSubscriptionId, {
      items: [{ id: item.id, price: this.priceIdFor(input.selection) }],
      // Matches the Paddle adapter's contract: upgrades bill now, downgrades
      // take effect at renewal so nothing already paid for is clawed back.
      proration_behavior: input.isUpgrade ? 'always_invoice' : 'none',
    });
    return this.normalize(updated);
  }

  async cancelAtPeriodEnd(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const stripe = await this.stripe();
    return this.normalize(
      await stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: true }),
    );
  }

  async resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    const stripe = await this.stripe();
    return this.normalize(
      await stripe.subscriptions.update(providerSubscriptionId, { cancel_at_period_end: false }),
    );
  }

  // ── Billing documents ────────────────────────────────────────────────────

  async listInvoices(customerId: string, limit: number): Promise<ProviderInvoice[]> {
    const stripe = await this.stripe();
    const invoices = await stripe.invoices.list({ customer: customerId, limit });
    return invoices.data.map(toProviderInvoice);
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────

  async verifyAndParseWebhook(request: WebhookRequest): Promise<ProviderWebhookEvent> {
    this.assertActive();
    const secret = this.config.stripe.webhookSecret;
    if (!secret) {
      throw new BillingProviderUnconfiguredError(
        'Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET.',
      );
    }

    const header = request.headers['stripe-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      throw new ExternalServiceError('Missing Stripe signature header.');
    }

    const stripe = await this.stripe();
    // Throws on a bad signature or a timestamp outside the tolerance window.
    const event = stripe.webhooks.constructEvent(request.rawBody, signature, secret);
    return this.toDomainEvent(event);
  }

  private toDomainEvent(event: Stripe.Event): ProviderWebhookEvent {
    const base = {
      provider: this.provider,
      id: event.id,
      type: event.type,
      occurredAt: new Date(event.created * 1000),
      subscription: null,
      invoice: null,
      ignored: false,
    };

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return { ...base, subscription: this.normalize(event.data.object) };

      case 'checkout.session.completed': {
        // The session names its subscription but carries no subscription state,
        // so the caller re-reads it. `client_reference_id` is the tenant.
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) return { ...base, ignored: true };
        return {
          ...base,
          subscription: {
            provider: this.provider,
            providerCustomerId:
              typeof session.customer === 'string'
                ? session.customer
                : (session.customer?.id ?? ''),
            providerSubscriptionId: subscriptionId,
            providerPriceId: null,
            companyId: session.client_reference_id ?? null,
            // NONE means "this event names a subscription but does not describe it":
            // the processor re-reads live state instead of storing this.
            status: SubscriptionStatus.NONE,
            plan: null,
            interval: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            trialEndsAt: null,
          },
        };
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        return {
          ...base,
          invoice: toProviderInvoice(invoice),
          // Carries the subscription id, so the caller re-reads live state.
          subscription: subscriptionIdFromInvoice(invoice)
            ? {
                provider: this.provider,
                providerCustomerId: '',
                providerSubscriptionId: subscriptionIdFromInvoice(invoice) as string,
                providerPriceId: null,
                companyId: null,
                // NONE means "this event names a subscription but does not describe it":
                // the processor re-reads live state instead of storing this.
                status: SubscriptionStatus.NONE,
                plan: null,
                interval: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                canceledAt: null,
                trialEndsAt: null,
              }
            : null,
        };
      }

      default:
        return { ...base, ignored: true };
    }
  }

  private normalize(subscription: Stripe.Subscription): ProviderSubscription {
    const normalized = toProviderSubscription(subscription);
    const match = this.planForPriceId(normalized.providerPriceId);
    return { ...normalized, plan: match?.plan ?? null, interval: match?.interval ?? null };
  }
}
