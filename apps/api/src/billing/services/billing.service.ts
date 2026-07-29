import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Invoice, Subscription } from '@prisma/client';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  ApiErrorCode,
  BillingInterval,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@rooferslabs/shared';
import { BusinessRuleError, NotFoundError } from '../../common/exceptions/domain.exception';
import { CompaniesService } from '../../companies/companies.service';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BILLING_PROVIDER, type BillingProvider } from '../interfaces/billing-provider.interface';
import { BillingRepository } from '../repositories/billing.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import type { PlanSelection, ProviderSubscription } from '../types/billing.types';

/** The billing view the frontend renders and gates on. */
export interface SubscriptionSummary {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  interval: BillingInterval | null;
  /** True when the tenant may use the application right now. */
  isActive: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  /**
   * Whether a billing account exists provider-side, which is what decides
   * whether the portal can be opened. Deliberately not named after a processor:
   * the client must not learn which one is in use.
   */
  hasBillingAccount: boolean;
}

/** One row of the tenant's payment history. */
export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  /** Minor units, as stored. Formatting is the client's job. */
  amountDue: number;
  amountPaid: number;
  issuedAt: string | null;
  invoiceUrl: string | null;
}

/**
 * Plan ordering, used to tell an upgrade from a downgrade.
 *
 * Explicit rather than derived from price, because the answer must not change
 * when someone edits a price in a provider dashboard — proration behaviour
 * hangs off it.
 */
const PLAN_RANK: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.STARTER]: 1,
  [SubscriptionPlan.PROFESSIONAL]: 2,
};

const INVOICE_PAGE_SIZE = 20;

/**
 * Subscription lifecycle for a tenant — the single entry point to billing.
 *
 * Nothing outside this module talks to a payment provider, and this service
 * talks to exactly one thing: the {@link BillingProvider} port. It never
 * mentions Paddle or Stripe, which is what makes the processor a configuration
 * choice rather than an architectural commitment.
 *
 * The provider stays the source of truth. Every state transition arrives
 * through a verified webhook and is mirrored into the local `subscriptions`
 * row, which is what request-time authorization reads — so entitlement checks
 * never depend on an outbound API call.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  /** Short TTL: a webhook invalidates explicitly, this only bounds the blast
   *  radius of a missed invalidation (e.g. while Redis was down). */
  private readonly entitlementTtl = 60;

  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly repo: BillingRepository,
    private readonly invoices: InvoiceRepository,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly companies: CompaniesService,
  ) {}

  private entitlementKey(companyId: string): string {
    return `billing:active:${companyId}`;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** What the browser needs to open a checkout. Contains no secrets. */
  getPublicConfig(): { provider: PaymentProvider; clientToken: string; environment: string } {
    return {
      provider: this.config.payments.provider,
      // Publishable by design: it identifies the seller account and can only
      // open checkouts. The API key never leaves the server.
      clientToken:
        this.config.payments.provider === PaymentProvider.PADDLE
          ? this.config.paddle.clientToken
          : '',
      environment: this.config.paddle.environment,
    };
  }

  /** The tenant's billing state; a tenant that never started checkout gets NONE. */
  async getSummary(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.repo.findByCompanyId(companyId);
    const summary = BillingService.toSummary(subscription);

    // A grandfathered tenant keeps its real status — it genuinely has no
    // subscription — but reads as entitled, so the frontend guard lets it into
    // the application instead of bouncing it to /payment. This must agree with
    // hasActiveSubscription() or the client and the API would disagree about
    // who is allowed in.
    if (!summary.isActive && (await this.isGrandfathered(companyId))) {
      return { ...summary, isActive: true };
    }
    return summary;
  }

  /** The tenant's synchronized payment history, newest first. */
  async listInvoices(companyId: string): Promise<InvoiceSummary[]> {
    const rows = await this.invoices.listByCompanyId(companyId, INVOICE_PAGE_SIZE);
    return rows.map(BillingService.toInvoiceSummary);
  }

  /**
   * Whether the tenant is entitled to use the application. Read on every gated
   * request, so the answer is cached briefly and invalidated on any state change.
   */
  async hasActiveSubscription(companyId: string): Promise<boolean> {
    // With billing switched off there is no wall to enforce: every tenant is
    // entitled. Checked before the cache so flipping the flag takes effect
    // immediately rather than after the entitlement TTL expires.
    if (!this.config.payments.enabled) return true;

    const cached = await this.redis.get<boolean>(this.entitlementKey(companyId));
    if (cached !== null) return cached;

    const subscription = await this.repo.findByCompanyId(companyId);
    const isActive = subscription
      ? ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status as SubscriptionStatus)
      : await this.isGrandfathered(companyId);

    await this.redis.set(this.entitlementKey(companyId), isActive, this.entitlementTtl);
    return isActive;
  }

  /**
   * Whether this tenant predates the payment wall and is therefore exempt from
   * it. Existing accounts keep working; anyone created on or after the cutoff
   * pays like normal.
   *
   * Deliberately keyed on `Company.createdAt` rather than a stored flag, so the
   * exemption is a property of when the tenant signed up and cannot be widened
   * by a later write. With no cutoff configured this is always false.
   */
  private async isGrandfathered(companyId: string): Promise<boolean> {
    const cutoff = this.config.payments.grandfatherBefore;
    if (!cutoff) return false;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { createdAt: true },
    });
    return company ? company.createdAt < cutoff : false;
  }

  static toSummary(subscription: Subscription | null): SubscriptionSummary {
    if (!subscription) {
      return {
        status: SubscriptionStatus.NONE,
        plan: null,
        interval: null,
        isActive: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
        hasBillingAccount: false,
      };
    }
    const status = subscription.status as SubscriptionStatus;
    return {
      status,
      plan: (subscription.plan as SubscriptionPlan | null) ?? null,
      interval: (subscription.billingInterval as BillingInterval | null) ?? null,
      isActive: ACTIVE_SUBSCRIPTION_STATUSES.includes(status),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      hasBillingAccount: true,
    };
  }

  static toInvoiceSummary(invoice: Invoice): InvoiceSummary {
    return {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status as InvoiceStatus,
      currency: invoice.currency,
      amountDue: invoice.amountDue,
      amountPaid: invoice.amountPaid,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      invoiceUrl: invoice.invoiceUrl,
    };
  }

  // ── Checkout & portal ────────────────────────────────────────────────────

  /**
   * Start a checkout for a plan.
   *
   * The provider-side customer is created on first use and reused thereafter,
   * so a tenant never accumulates duplicate customers across retries. The
   * returned handle is whatever the active provider offers — a URL to navigate
   * to, an id for its browser SDK, or both.
   */
  async createCheckout(
    companyId: string,
    selection: PlanSelection,
  ): Promise<{ provider: PaymentProvider; url: string | null; transactionId: string | null }> {
    const existing = await this.repo.findByCompanyId(companyId);
    if (existing && ACTIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)) {
      throw new BusinessRuleError(
        'This account already has an active subscription. Use the billing portal to change plans.',
      );
    }

    const customerId = await this.resolveCustomerId(companyId, existing);
    const web = this.config.api.webPublicUrl;

    const handle = await this.provider.createCheckout({
      companyId,
      customerId,
      selection,
      successUrl: `${web}/billing?checkout=success`,
      cancelUrl: `${web}/payment?checkout=cancelled`,
      trialPeriodDays: this.config.payments.trialPeriodDays,
    });

    if (!handle.url && !handle.transactionId) {
      throw new BusinessRuleError('Could not start checkout. Please try again.');
    }

    this.logger.log(
      `Checkout started for company ${companyId} (${selection.plan}/${selection.interval})`,
    );
    return handle;
  }

  /** Open the provider's hosted portal for payment methods, invoices and receipts. */
  async createBillingPortalSession(companyId: string): Promise<{ url: string }> {
    const subscription = await this.repo.findByCompanyId(companyId);
    if (!subscription) {
      throw new NotFoundError(
        'No billing account exists yet. Start a subscription first.',
        ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }
    this.assertSameProvider(subscription);

    return this.provider.createPortalSession({
      customerId: subscription.providerCustomerId,
      subscriptionId: subscription.providerSubscriptionId,
      returnUrl: `${this.config.api.webPublicUrl}/billing`,
    });
  }

  // ── Lifecycle actions ────────────────────────────────────────────────────

  /**
   * Move to a different plan.
   *
   * Upgrades take effect immediately, downgrades at the next renewal — the
   * provider adapter implements that, but the decision of which this *is* lives
   * here, because it is a product rule rather than a processor detail.
   */
  async changePlan(companyId: string, selection: PlanSelection): Promise<SubscriptionSummary> {
    const subscription = await this.requireProviderSubscription(companyId);

    const current = subscription.plan as SubscriptionPlan | null;
    const currentInterval = subscription.billingInterval as BillingInterval | null;
    if (current === selection.plan && currentInterval === selection.interval) {
      throw new BusinessRuleError('This account is already on that plan.');
    }

    // An interval change with no plan change is treated as an upgrade when
    // moving to annual: the tenant is committing to (and paying for) more.
    const isUpgrade =
      current === null
        ? true
        : PLAN_RANK[selection.plan] > PLAN_RANK[current] ||
          (PLAN_RANK[selection.plan] === PLAN_RANK[current] &&
            selection.interval === BillingInterval.YEAR);

    const updated = await this.provider.changePlan({
      providerSubscriptionId: subscription.providerSubscriptionId!,
      selection,
      isUpgrade,
    });
    this.logger.log(
      `Company ${companyId} moved to ${selection.plan}/${selection.interval} (${isUpgrade ? 'upgrade' : 'downgrade'})`,
    );
    return this.applySubscription(updated);
  }

  /**
   * Cancel at period end. Access continues until the paid term expires, and no
   * customer data is ever deleted — the tenant simply loses access afterwards.
   */
  async cancelSubscription(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireProviderSubscription(companyId);
    if (subscription.cancelAtPeriodEnd) {
      throw new BusinessRuleError('This subscription is already scheduled to end.');
    }
    const updated = await this.provider.cancelAtPeriodEnd(subscription.providerSubscriptionId!);
    this.logger.log(`Subscription for company ${companyId} set to cancel at period end`);
    return this.applySubscription(updated);
  }

  /** Undo a pending cancellation while the subscription is still running. */
  async resumeSubscription(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireProviderSubscription(companyId);
    if (!subscription.cancelAtPeriodEnd) {
      throw new BusinessRuleError('This subscription is not scheduled for cancellation.');
    }
    const updated = await this.provider.resumeSubscription(subscription.providerSubscriptionId!);
    this.logger.log(`Subscription for company ${companyId} resumed`);
    return this.applySubscription(updated);
  }

  // ── State synchronization ────────────────────────────────────────────────

  /**
   * Mirror a provider subscription into the local row.
   *
   * The tenant is resolved from the reference the provider echoed back (set at
   * checkout), falling back to the stored customer id, so an event is never
   * applied to the wrong company. Returns null when neither resolves — an event
   * for a customer this deployment has never heard of, which is normal when a
   * sandbox and a production account share a webhook target.
   */
  async applySubscription(
    subscription: ProviderSubscription,
    fallbackCompanyId?: string | null,
  ): Promise<SubscriptionSummary> {
    const existing = await this.repo.findByProviderCustomerId(
      subscription.provider,
      subscription.providerCustomerId,
    );
    const companyId = existing?.companyId ?? subscription.companyId ?? fallbackCompanyId ?? null;

    if (!companyId) {
      this.logger.warn(
        `Subscription ${subscription.providerSubscriptionId} could not be matched to a company — ignoring.`,
      );
      return BillingService.toSummary(null);
    }

    // Read the tenant's state before the upsert so activation can be detected
    // as a transition rather than a level — providers redeliver events and send
    // several that all describe an already-active subscription.
    const previous = await this.repo.findByCompanyId(companyId);
    const wasActive = previous
      ? ACTIVE_SUBSCRIPTION_STATUSES.includes(previous.status as SubscriptionStatus)
      : false;

    const row = await this.repo.upsert(companyId, {
      provider: subscription.provider,
      providerCustomerId: subscription.providerCustomerId,
      providerSubscriptionId: subscription.providerSubscriptionId,
      providerPriceId: subscription.providerPriceId,
      status: subscription.status,
      plan: subscription.plan,
      billingInterval: subscription.interval,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      trialEndsAt: subscription.trialEndsAt,
    });

    // Entitlement changed — the next gated request must re-read it.
    await this.redis.del(this.entitlementKey(companyId));

    this.logger.log(
      `Subscription for company ${companyId} is now ${row.status} (${subscription.providerSubscriptionId})`,
    );

    // First moment this tenant is entitled to service: buy its dedicated AI
    // number. This used to happen when onboarding completed, but onboarding now
    // runs before payment, so provisioning there would purchase a real number
    // for tenants who finish setup and never subscribe.
    //
    // Guarded on the transition so redelivered events never re-run it, and the
    // call itself is both idempotent and non-throwing — a Twilio failure must
    // not fail the webhook, or the provider would retry the entire event.
    const isNowActive = ACTIVE_SUBSCRIPTION_STATUSES.includes(row.status as SubscriptionStatus);
    if (isNowActive && !wasActive) {
      await this.companies.provisionReceptionistNumber(companyId);
    }

    return BillingService.toSummary(row);
  }

  /**
   * Mirror a provider invoice into the local table.
   *
   * Resolved to a tenant through the subscription or customer the invoice names.
   * An invoice we cannot attribute is dropped rather than stored against a
   * guess — a payment history is not worth corrupting to avoid a gap.
   */
  async applyInvoice(invoice: Parameters<InvoiceRepository['sync']>[2]): Promise<void> {
    const owner = invoice.providerSubscriptionId
      ? await this.repo.findByProviderSubscriptionId(
          invoice.provider,
          invoice.providerSubscriptionId,
        )
      : invoice.providerCustomerId
        ? await this.repo.findByProviderCustomerId(invoice.provider, invoice.providerCustomerId)
        : null;

    if (!owner) {
      this.logger.warn(
        `Invoice ${invoice.providerInvoiceId} could not be matched to a company — ignoring.`,
      );
      return;
    }

    await this.invoices.sync(owner.companyId, owner.id, invoice);
    this.logger.log(`Invoice ${invoice.providerInvoiceId} synced for company ${owner.companyId}`);
  }

  /** Re-read a subscription from the provider and store what it says. */
  async refreshSubscription(providerSubscriptionId: string): Promise<void> {
    const live = await this.provider.getSubscription(providerSubscriptionId);
    await this.applySubscription(live);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Reuse the tenant's provider customer, creating (or replacing) it as needed. */
  private async resolveCustomerId(
    companyId: string,
    existing: Subscription | null,
  ): Promise<string> {
    // Only reusable if it belongs to the provider we are about to bill through.
    // A row left behind by a previous processor names a customer that does not
    // exist in the current one.
    if (
      existing &&
      existing.provider === this.provider.provider &&
      (await this.provider.customerExists(existing.providerCustomerId))
    ) {
      return existing.providerCustomerId;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }

    const customerId = await this.provider.createCustomer({
      companyId,
      companyName: company.name,
      email: await this.resolveBillingEmail(companyId, company.email),
    });

    if (existing) {
      await this.repo.update(companyId, {
        provider: this.provider.provider,
        providerCustomerId: customerId,
        // The old provider's subscription does not carry over.
        providerSubscriptionId: null,
        providerPriceId: null,
      });
    } else {
      await this.repo.create({
        companyId,
        provider: this.provider.provider,
        providerCustomerId: customerId,
        status: SubscriptionStatus.NONE,
      });
    }
    await this.redis.del(this.entitlementKey(companyId));
    return customerId;
  }

  /**
   * An address to bill.
   *
   * The company email is optional in our schema but mandatory to every payment
   * provider — a receipt has to go somewhere. The owner's account email is the
   * natural fallback, since that is the person who signed the company up.
   */
  private async resolveBillingEmail(
    companyId: string,
    companyEmail: string | null,
  ): Promise<string> {
    if (companyEmail) return companyEmail;

    const owner = await this.prisma.user.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    if (owner?.email) return owner.email;

    throw new BusinessRuleError(
      'Add a company email address in settings before subscribing — receipts are sent there.',
    );
  }

  private async requireProviderSubscription(companyId: string): Promise<Subscription> {
    const subscription = await this.repo.findByCompanyId(companyId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundError(
        'No subscription to manage. Start a subscription first.',
        ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }
    this.assertSameProvider(subscription);
    return subscription;
  }

  /**
   * Refuse to operate on a record minted by a different processor.
   *
   * This is the guard that makes a provider switch safe: a tenant subscribed
   * under the old provider cannot have its subscription cancelled or changed
   * through the new one, where those identifiers mean nothing. It must start a
   * fresh checkout instead.
   */
  private assertSameProvider(subscription: Subscription): void {
    if (subscription.provider !== this.provider.provider) {
      throw new BusinessRuleError(
        'This subscription was created with a previous payment provider and cannot be managed here. ' +
          'Please start a new subscription.',
      );
    }
  }
}
