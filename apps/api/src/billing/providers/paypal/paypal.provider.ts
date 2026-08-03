/**
 * The PayPal Subscriptions adapter.
 *
 * Everything above it speaks {@link BillingProvider}; everything below it is
 * PayPal's own vocabulary of billing plans, approval links and payer ids. The
 * client secret never leaves this process, and the browser is only ever handed
 * an approval URL, which is safe to expose and useless without the payer's own
 * PayPal login.
 *
 * ## Where PayPal does not fit the port, and what is done about it
 *
 * The port was written against processors that model a customer, a hosted
 * portal, and a scheduled cancellation. PayPal has none of those, so three
 * methods are honest adaptations rather than direct translations:
 *
 *  - **`createCustomer` / `customerExists`.** There is no customer object to
 *    create. A payer id only exists once someone has approved a subscription.
 *    `createCustomer` therefore mints nothing and returns a deterministic local
 *    handle; the real payer id replaces it the moment PayPal reports one.
 *  - **`createPortalSession`.** PayPal has no per-merchant hosted portal. The
 *    link returned is PayPal's own automatic-payments page, where a payer can
 *    genuinely manage the funding instrument behind a subscription. Plan
 *    changes and cancellation stay in our UI, where they always were.
 *  - **`cancelAtPeriodEnd`.** PayPal's cancel is immediate and irreversible.
 *    Suspending stops all further billing while keeping the subscription
 *    reinstatable, so that is what a scheduled cancellation does here; the
 *    sweep in `SubscriptionSweepService` performs the real cancel once the paid
 *    term lapses.
 */
import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import { ExternalServiceError } from '../../../common/exceptions/domain.exception';
import type { BillingProvider } from '../../interfaces/billing-provider.interface';
import type {
  CheckoutHandle,
  CreateCheckoutInput,
  CreateCustomerInput,
  PlanChangeResult,
  PlanSelection,
  ProviderSubscription,
  ProviderWebhookEvent,
  WebhookRequest,
} from '../../types/billing.types';
import { PayPalClient } from './paypal.client';
import { PayPalFunding } from './paypal.funding';
import { saleToProviderInvoice, toProviderSubscription } from './paypal.mapper';
import { PayPalPlans } from './paypal.plans';
import { approvalLink, PayPalSubscriptions } from './paypal.subscriptions';
import type { PayPalSaleResource, PayPalSubscription } from './paypal.types';
import { PayPalWebhookVerifier } from './paypal.webhook';

/**
 * The prefix on a customer id we minted ourselves, before PayPal knew the payer.
 *
 * Namespaced so it can never be mistaken for a real PayPal payer id, which is a
 * bare 13-character alphanumeric.
 */
const LOCAL_CUSTOMER_PREFIX = 'local:';

@Injectable()
export class PayPalProvider implements BillingProvider {
  readonly provider = PaymentProvider.PAYPAL;

  private readonly logger = new Logger(PayPalProvider.name);

  constructor(
    private readonly client: PayPalClient,
    private readonly plans: PayPalPlans,
    private readonly subscriptions: PayPalSubscriptions,
    private readonly verifier: PayPalWebhookVerifier,
    private readonly funding: PayPalFunding,
  ) {}

  get isConfigured(): boolean {
    return this.client.isConfigured;
  }

  /**
   * Only the sources this account can *vault*. A subscription is a billing
   * agreement, so a method PayPal will not store cannot back one — see
   * PayPalFunding for why eligibility alone is the wrong test.
   */
  fundingSources(): Promise<string[]> {
    return this.funding.sources();
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  priceIdFor(selection: PlanSelection): Promise<string> {
    return this.plans.planIdFor(selection);
  }

  planForPriceId(
    priceId: string | null | undefined,
  ): { plan: SubscriptionPlan; interval: BillingInterval } | null {
    return this.plans.planForPlanId(priceId);
  }

  // ── Customers ────────────────────────────────────────────────────────────

  /**
   * There is nothing to create.
   *
   * PayPal has no customer resource: a subscription is created against a plan,
   * and the payer identifies themselves by logging in to approve it. Returning a
   * deterministic local handle keeps the domain's "resolve a customer, then
   * check out" flow intact without inventing a remote object — and because it is
   * derived from the company id, a retried checkout reuses the same handle
   * instead of accumulating duplicates.
   */
  async createCustomer(input: CreateCustomerInput): Promise<string> {
    return Promise.resolve(`${LOCAL_CUSTOMER_PREFIX}${input.companyId}`);
  }

  /**
   * Whether a stored customer handle is still usable.
   *
   * A local handle always is — it names our own tenant, not a remote record. A
   * real payer id is equally durable: PayPal does not delete payers, and a
   * subscription that no longer exists is caught by `getSubscription`, not here.
   * The method exists to stop the domain re-creating customers needlessly, and
   * under PayPal there is nothing that could have gone stale.
   */
  async customerExists(customerId: string): Promise<boolean> {
    return Promise.resolve(Boolean(customerId));
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  /**
   * Create the subscription and hand back its approval link.
   *
   * Nothing is charged and no access is granted here: the subscription is
   * created in `APPROVAL_PENDING`, and only becomes real when the payer approves
   * it at PayPal and the resulting webhook arrives. Creating it server-side —
   * rather than letting the browser name a plan — is what stops a tenant
   * subscribing at a price we did not offer them.
   *
   * `trialPeriodDays` cannot be honoured per checkout: PayPal attaches a trial
   * to the *plan*, as a billing cycle with `tenure_type: TRIAL`. Configuring one
   * is a plan change, documented in docs/billing.md.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutHandle> {
    const planId = await this.priceIdFor(input.selection);

    if (input.trialPeriodDays > 0) {
      this.logger.warn(
        `BILLING_TRIAL_PERIOD_DAYS=${input.trialPeriodDays} is ignored under PayPal: ` +
          'trials are a billing cycle on the plan, not a per-subscription option.',
      );
    }

    let subscription: PayPalSubscription;
    try {
      subscription = await this.subscriptions.create({
        planId,
        companyId: input.companyId,
        companyName: input.companyName,
        email: input.email,
        returnUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
    } catch (error) {
      throw this.client.wrap(error, 'start a checkout');
    }

    const url = approvalLink(subscription?.links);
    if (!url) {
      // PayPal accepted the subscription but gave us nowhere to send the payer,
      // which means it cannot be approved and is dead on arrival.
      this.logger.error(`PayPal created subscription ${subscription?.id} with no approval link.`);
      throw new ExternalServiceError('Could not start a checkout. Please try again.');
    }

    return {
      provider: this.provider,
      url,
      successUrl: input.successUrl,
      subscriptionId: subscription.id ?? null,
    };
  }

  // ── Portal ───────────────────────────────────────────────────────────────

  /**
   * PayPal's automatic-payments page.
   *
   * Not a merchant-scoped portal and not a minted session — PayPal offers
   * neither. It is the payer's own list of recurring payments, where they can
   * change the funding source behind this subscription or see its history. It
   * requires their PayPal login, which is what makes handing out a static URL
   * safe: nothing is authorized by possessing it.
   *
   * Everything a tenant can do *to their rooferslabs subscription* — change
   * plan, cancel, resume — stays in our own billing page, so this is a
   * complement to that UI rather than a replacement for it.
   */
  async createPortalSession(_input: {
    customerId: string;
    subscriptionId: string | null;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const host = this.client.isLive ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
    return Promise.resolve({ url: `${host}/myaccount/autopay/` });
  }

  // ── Subscription lifecycle ───────────────────────────────────────────────

  async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      const subscription = await this.subscriptions.get(providerSubscriptionId);
      return this.normalize(subscription);
    } catch (error) {
      throw this.client.wrap(error, 'read the subscription');
    }
  }

  /**
   * Move a subscription to a different plan.
   *
   * PayPal decides whether the payer must consent: raising what they are billed
   * always requires it, lowering it does not. When consent is needed PayPal
   * answers with an approval link, and the change does not take effect until the
   * payer follows it — so the link is passed straight back up rather than
   * swallowed, and the subscription returned is still the *current* one.
   *
   * The upgrade/downgrade distinction the port draws is therefore informational
   * here: PayPal applies its own proration on the next cycle either way, and
   * there is no per-request proration mode to choose.
   */
  async changePlan(input: {
    providerSubscriptionId: string;
    selection: PlanSelection;
    isUpgrade: boolean;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PlanChangeResult> {
    const planId = await this.priceIdFor(input.selection);

    try {
      const { approvalUrl } = await this.subscriptions.revise(
        input.providerSubscriptionId,
        planId,
        input.returnUrl,
        input.cancelUrl,
      );
      const subscription = await this.subscriptions.get(input.providerSubscriptionId);
      return { subscription: this.normalize(subscription), approvalUrl };
    } catch (error) {
      throw this.client.wrap(error, 'change the plan');
    }
  }

  /**
   * Stop billing while leaving the paid term — and the tenant's access — intact.
   *
   * PayPal has no scheduled cancellation, and its `cancel` is both immediate and
   * final. Suspending is the only operation that stops money moving while
   * remaining reversible, so a cancel-at-period-end is a suspension plus the
   * intent recorded in our own row. `SubscriptionSweepService` performs the real
   * cancel once the term lapses.
   *
   * `cancelAtPeriodEnd: true` is asserted on the way out because PayPal's
   * payload cannot carry that intent — it only knows the subscription is
   * suspended, not why.
   */
  async cancelAtPeriodEnd(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      await this.subscriptions.suspend(
        providerSubscriptionId,
        'Cancellation requested by the customer; access continues until the paid term ends.',
      );
      const subscription = await this.subscriptions.get(providerSubscriptionId);
      return this.normalize(subscription, true);
    } catch (error) {
      throw this.client.wrap(error, 'cancel the subscription');
    }
  }

  /** Withdraw a pending cancellation by lifting the suspension. */
  async resumeSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
    try {
      await this.subscriptions.activate(
        providerSubscriptionId,
        'Cancellation withdrawn by the customer.',
      );
      const subscription = await this.subscriptions.get(providerSubscriptionId);
      return this.normalize(subscription, false);
    } catch (error) {
      throw this.client.wrap(error, 'resume the subscription');
    }
  }

  /** End the subscription for good. Called only by the sweep. */
  async cancelImmediately(providerSubscriptionId: string): Promise<void> {
    try {
      await this.subscriptions.cancel(
        providerSubscriptionId,
        'The cancelled subscription reached the end of its paid term.',
      );
    } catch (error) {
      throw this.client.wrap(error, 'finalize the cancellation');
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────

  /**
   * Verify an inbound webhook and reduce it to a domain event.
   *
   * Verification is PayPal's own — see `paypal.webhook.ts` — and anything it
   * rejects throws before the payload is read for meaning.
   */
  async verifyAndParseWebhook(request: WebhookRequest): Promise<ProviderWebhookEvent> {
    const event = await this.verifier.verify(request);

    const base = {
      provider: this.provider,
      id: event.id,
      type: event.event_type,
      occurredAt: new Date(event.create_time),
      subscription: null,
      invoice: null,
      ignored: false,
    };

    switch (event.event_type) {
      // The subscription's own lifecycle. The resource is the full subscription,
      // so no follow-up read is needed.
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
        return {
          ...base,
          subscription: this.normalize(event.resource as PayPalSubscription),
        };

      // Money. A sale names its subscription through `billing_agreement_id`,
      // which is both how it is attributed and the earliest reliable signal that
      // a first payment has settled — the caller re-reads the subscription so
      // the stored period reflects PayPal now rather than whatever this payload
      // captured.
      case 'PAYMENT.SALE.COMPLETED':
      case 'PAYMENT.SALE.DENIED':
      case 'PAYMENT.SALE.REFUNDED':
      case 'PAYMENT.SALE.REVERSED':
        return {
          ...base,
          invoice: saleToProviderInvoice(event.resource as PayPalSaleResource),
        };

      // A failed payment does not carry a sale, only the subscription whose
      // charge failed. Treated as a subscription event so the status PayPal
      // reports — usually still ACTIVE, pending retry — is mirrored.
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        return {
          ...base,
          subscription: this.normalize(event.resource as PayPalSubscription),
        };

      default:
        return { ...base, ignored: true };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Attach the plan the configured catalogue says this plan id belongs to.
   *
   * PayPal reports only the plan id, and the interval is a property of the plan
   * rather than of the subscription, so both are resolved from our own table.
   */
  private normalize(
    subscription: PayPalSubscription,
    cancelAtPeriodEnd = false,
  ): ProviderSubscription {
    const normalized = toProviderSubscription(subscription, cancelAtPeriodEnd);
    const match = this.planForPriceId(normalized.providerPriceId);
    return {
      ...normalized,
      plan: match?.plan ?? null,
      interval: match?.interval ?? null,
    };
  }
}
