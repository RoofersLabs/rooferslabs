import { Injectable, Logger } from '@nestjs/common';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import type { Subscription as PaddleSubscription } from '@paddle/paddle-node-sdk';
import { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import {
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
import { toProviderInvoice, toProviderSubscription } from './paddle.mapper';

/**
 * The Paddle Billing adapter — the only file in the application that imports
 * the Paddle SDK.
 *
 * Everything above it speaks {@link BillingProvider}; everything below it is
 * Paddle's own vocabulary of transactions, customers and scheduled changes. The
 * API key never leaves this process, and the browser is only ever handed a
 * transaction id or a checkout URL, both of which are safe to expose.
 */
@Injectable()
export class PaddleProvider implements BillingProvider {
  readonly provider = PaymentProvider.PADDLE;

  private readonly logger = new Logger(PaddleProvider.name);
  private client: Paddle | null = null;

  constructor(private readonly config: AppConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.paddle.apiKey);
  }

  /**
   * The Paddle client, constructed on first use.
   *
   * Lazy so the process boots without billing credentials — a developer running
   * the app locally should not need a Paddle account to sign in. The instance is
   * cached because it holds a connection pool.
   */
  private get paddle(): Paddle {
    if (!this.isConfigured) {
      throw new BillingProviderUnconfiguredError(
        'Paddle is not configured. Set PADDLE_API_KEY to enable billing.',
      );
    }
    this.client ??= new Paddle(this.config.paddle.apiKey, {
      environment:
        this.config.paddle.environment === 'production'
          ? Environment.production
          : Environment.sandbox,
    });
    return this.client;
  }

  private get prices(): PriceTable {
    return this.config.paddle.prices;
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  priceIdFor(selection: PlanSelection): string {
    const priceId = this.prices[selection.plan]?.[selection.interval];
    if (!priceId) {
      // Reached for annual plans until they are launched: the plan exists in
      // the enum, the price simply has not been created in Paddle yet.
      throw new ExternalServiceError(
        `No Paddle price is configured for the ${selection.plan} plan billed ${selection.interval.toLowerCase()}ly.`,
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
          return {
            plan: plan as SubscriptionPlan,
            interval: interval as BillingInterval,
          };
        }
      }
    }
    return null;
  }

  // ── Customers ────────────────────────────────────────────────────────────

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    try {
      const customer = await this.paddle.customers.create({
        email: input.email,
        name: input.companyName,
        // Echoed back on every subscription and event derived from this
        // customer, so a webhook can always be traced to the tenant even if our
        // local row is missing.
        customData: { companyId: input.companyId },
      });
      this.logger.log(`Created Paddle customer ${customer.id} for company ${input.companyId}`);
      return customer.id;
    } catch (error) {
      // Paddle rejects a duplicate email rather than returning the existing
      // customer, which happens whenever a tenant's first checkout was
      // abandoned after the customer was created but before we stored the id.
      // Recovering the existing customer is correct and keeps the tenant from
      // being permanently unable to subscribe.
      const existing = await this.findCustomerByEmail(input.email);
      if (existing) {
        this.logger.warn(
          `Paddle customer for ${input.companyId} already existed (${existing}); reusing it.`,
        );
        return existing;
      }
      throw this.wrap(error, 'create a billing customer');
    }
  }

  private async findCustomerByEmail(email: string): Promise<string | null> {
    try {
      const page = await this.paddle.customers.list({ email: [email], perPage: 1 }).next();
      return page[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  async customerExists(customerId: string): Promise<boolean> {
    try {
      const customer = await this.paddle.customers.get(customerId);
      // A Paddle customer is archived rather than deleted; an archived one can
      // no longer be charged, so it is as good as gone for our purposes.
      return customer.status === 'active';
    } catch {
      return false;
    }
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  /**
   * Start a checkout by creating the transaction it will settle.
   *
   * Paddle inverts Stripe's model: rather than a server-created hosted session,
   * the checkout is opened in the browser by Paddle.js against a transaction we
   * create here. Doing it server-side (instead of letting the browser name its
   * own price) is what stops a tenant from checking out at a price we did not
   * offer them.
   *
   * `checkout.url` is Paddle's default payment link with the transaction
   * appended, and is returned alongside the id so a client that cannot run
   * Paddle.js still has a way through.
   *
   * Note on trials: Paddle attaches a free trial to the *price*, not to the
   * checkout, so `input.trialPeriodDays` cannot be honoured here. Trials are
   * configured on the price in the Paddle dashboard — see docs/billing.md.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandle> {
    const priceId = this.priceIdFor(input.selection);

    if (input.trialPeriodDays > 0) {
      this.logger.warn(
        `BILLING_TRIAL_PERIOD_DAYS=${input.trialPeriodDays} is ignored under Paddle: ` +
          'trials are configured on the price in the Paddle dashboard, not per checkout.',
      );
    }

    try {
      const transaction = await this.paddle.transactions.create({
        items: [{ priceId, quantity: 1 }],
        customerId: input.customerId,
        // Mirrored onto the resulting subscription, which is how every later
        // webhook resolves the tenant.
        customData: { companyId: input.companyId },
        checkout: { url: input.successUrl },
      });

      return {
        provider: this.provider,
        url: transaction.checkout?.url ?? null,
        transactionId: transaction.id,
      };
    } catch (error) {
      throw this.wrap(error, 'start a checkout');
    }
  }

  // ── Portal ───────────────────────────────────────────────────────────────

  /**
   * Mint a single-use link into Paddle's hosted customer portal.
   *
   * The tokens on these URLs are short-lived and single-use, so the link is
   * created per request and never cached. When we know the subscription we hand
   * back the deep link for it; otherwise the portal overview.
   */
  async createPortalSession(input: {
    customerId: string;
    subscriptionId: string | null;
    returnUrl: string;
  }): Promise<{ url: string }> {
    try {
      const session = await this.paddle.customerPortalSessions.create(
        input.customerId,
        input.subscriptionId ? [input.subscriptionId] : [],
      );

      const deepLink = input.subscriptionId
        ? session.urls.subscriptions.find((s) => s.id === input.subscriptionId)
        : undefined;

      // `updateSubscriptionPaymentMethod` is the most useful landing point:
      // a tenant opening "manage billing" is usually there to fix a card. The
      // portal overview is the fallback, and always exists.
      const url = deepLink?.updateSubscriptionPaymentMethod ?? session.urls.general.overview;
      return { url };
    } catch (error) {
      throw this.wrap(error, 'open the billing portal');
    }
  }

  // ── Subscription lifecycle ───────────────────────────────────────────────

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      return this.normalize(await this.paddle.subscriptions.get(providerSubscriptionId));
    } catch (error) {
      throw this.wrap(error, 'read the subscription');
    }
  }

  /**
   * Move a subscription to a different plan.
   *
   * Upgrades bill immediately and pro-rata, so the tenant gets what it just paid
   * for straight away. Downgrades are deferred to the next renewal: charging a
   * credit for unused time on a plan the tenant chose to leave is both
   * surprising and, in Paddle, refundable only by hand.
   */
  async changePlan(input: {
    providerSubscriptionId: string;
    selection: PlanSelection;
    isUpgrade: boolean;
  }): Promise<ProviderSubscription> {
    const priceId = this.priceIdFor(input.selection);
    try {
      const updated = await this.paddle.subscriptions.update(input.providerSubscriptionId, {
        items: [{ priceId, quantity: 1 }],
        prorationBillingMode: input.isUpgrade
          ? 'prorated_immediately'
          : 'prorated_next_billing_period',
      });
      return this.normalize(updated);
    } catch (error) {
      throw this.wrap(error, 'change the plan');
    }
  }

  /**
   * Schedule cancellation for the end of the paid term.
   *
   * Never `immediately`: the tenant has paid through the period and keeps
   * access until it ends. Paddle records this as a scheduled change rather than
   * a status change, so the subscription stays `active` until the date passes.
   */
  async cancelAtPeriodEnd(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      const canceled = await this.paddle.subscriptions.cancel(providerSubscriptionId, {
        effectiveFrom: 'next_billing_period',
      });
      return this.normalize(canceled);
    } catch (error) {
      throw this.wrap(error, 'cancel the subscription');
    }
  }

  /**
   * Withdraw a pending cancellation.
   *
   * A cancellation that has already taken effect cannot be undone — Paddle has
   * no reinstate operation, and the subscription is genuinely gone. This only
   * removes a *scheduled* change, which is why the caller checks that one is
   * pending first.
   */
  async resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      const resumed = await this.paddle.subscriptions.update(providerSubscriptionId, {
        scheduledChange: null,
      });
      return this.normalize(resumed);
    } catch (error) {
      throw this.wrap(error, 'resume the subscription');
    }
  }

  // ── Billing documents ────────────────────────────────────────────────────

  /**
   * Recent billing documents for a customer.
   *
   * Paddle has no distinct invoice object for subscriptions — a transaction is
   * the billing document. Only one page is read: this backs a "recent invoices"
   * table, and a tenant that needs its full history is sent to the portal.
   */
  async listInvoices(customerId: string, limit: number): Promise<ProviderInvoice[]> {
    try {
      const page = await this.paddle.transactions
        .list({ customerId: [customerId], perPage: limit, orderBy: 'created_at[DESC]' })
        .next();
      return page.map(toProviderInvoice);
    } catch (error) {
      throw this.wrap(error, 'list invoices');
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────

  /**
   * Verify an inbound webhook and reduce it to a domain event.
   *
   * `unmarshal` performs the whole security check: it recomputes the HMAC over
   * `timestamp:rawBody` with the endpoint secret, compares in constant time, and
   * enforces a timestamp tolerance that makes a captured request useless to
   * replay later. It throws on any failure, and this method lets that propagate
   * — an unverified payload must never reach the domain.
   */
  async verifyAndParseWebhook(request: WebhookRequest): Promise<ProviderWebhookEvent> {
    const secret = this.config.paddle.webhookSecret;
    if (!secret) {
      throw new BillingProviderUnconfiguredError(
        'Paddle webhooks are not configured. Set PADDLE_WEBHOOK_SECRET.',
      );
    }

    const header = request.headers['paddle-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      throw new ExternalServiceError('Missing Paddle-Signature header.');
    }

    // The body must be handed over exactly as received. Decoding the buffer as
    // UTF-8 is byte-preserving for the JSON Paddle sends; re-serializing a
    // parsed object would not be, and would fail every signature.
    const event = await this.paddle.webhooks.unmarshal(
      request.rawBody.toString('utf8'),
      secret,
      signature,
    );

    if (!event) {
      throw new ExternalServiceError('Paddle webhook payload could not be parsed.');
    }

    return this.toDomainEvent(event);
  }

  /**
   * Reduce a verified Paddle event to the two facts the domain acts on.
   *
   * Subscription events carry the whole subscription, so no follow-up read is
   * needed. Transaction events are only interesting once they have actually
   * been billed or have failed — the rest of a transaction's lifecycle is noise
   * for our purposes.
   */
  private toDomainEvent(event: {
    eventId: string;
    eventType: string;
    occurredAt: string;
    data: unknown;
  }): ProviderWebhookEvent {
    const base = {
      provider: this.provider,
      id: event.eventId,
      type: event.eventType,
      occurredAt: new Date(event.occurredAt),
      subscription: null,
      invoice: null,
      ignored: false,
    };

    switch (event.eventType) {
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.canceled':
      case 'subscription.paused':
      case 'subscription.resumed':
      case 'subscription.trialing':
      case 'subscription.past_due':
        return {
          ...base,
          subscription: this.normalize(event.data as PaddleSubscription),
        };

      // A transaction tells us about money, and — because it names its
      // subscription — is also the earliest reliable signal that a first
      // payment has settled. The subscription itself is re-read by the caller
      // so the stored period and status reflect Paddle right now rather than
      // whatever this payload happened to capture.
      case 'transaction.completed':
      case 'transaction.billed':
      case 'transaction.payment_failed':
      case 'transaction.past_due':
        return {
          ...base,
          invoice: toProviderInvoice(event.data as Parameters<typeof toProviderInvoice>[0]),
        };

      default:
        return { ...base, ignored: true };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Attach the plan we know the price belongs to; Paddle only reports the price. */
  private normalize(subscription: PaddleSubscription): ProviderSubscription {
    const normalized = toProviderSubscription(subscription);
    const match = this.planForPriceId(normalized.providerPriceId);
    return {
      ...normalized,
      plan: match?.plan ?? null,
      interval: match?.interval ?? normalized.interval,
    };
  }

  /**
   * Convert an SDK failure into a domain error.
   *
   * Paddle's message is logged for triage but never returned to the client: it
   * can name prices, customers and account internals that a tenant has no
   * business seeing.
   */
  private wrap(error: unknown, action: string): Error {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.error(`Paddle failed to ${action}: ${detail}`);
    return new ExternalServiceError(`Could not ${action}. Please try again.`);
  }
}
