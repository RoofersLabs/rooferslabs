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
import type { CheckoutHandle, PlanSelection, ProviderSubscription } from '../types/billing.types';

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

/**
 * A plan change, plus wherever the payer still has to go to consent to it.
 *
 * `approvalUrl` is null for a change that is already done. When it is set, the
 * subscription in this summary is still the *old* plan — the new one takes
 * effect when the payer follows the link.
 */
export interface PlanChangeSummary extends SubscriptionSummary {
  approvalUrl: string | null;
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
 * mentions PayPal or Stripe, which is what makes the processor a configuration
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

  /**
   * What the browser needs to start a checkout. Contains no secrets, and no
   * credential of any kind.
   *
   * Both supported processors are redirect-based, so the client needs nothing to
   * open a payment beyond the URL the server hands it. `environment` is here
   * purely so the UI can say out loud when it is pointed at a sandbox — a
   * checkout that takes no money should never look like one that does.
   */
  getPublicConfig(): { provider: PaymentProvider; environment: string } {
    return {
      provider: this.config.payments.provider,
      environment: this.config.paypal.environment,
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
  async createCheckout(companyId: string, selection: PlanSelection): Promise<CheckoutHandle> {
    const existing = await this.repo.findByCompanyId(companyId);
    if (existing && ACTIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)) {
      throw new BusinessRuleError(
        'This account already has an active subscription. Use the billing portal to change plans.',
      );
    }

    const company = await this.requireCompany(companyId);
    const email = await this.resolveBillingEmail(companyId, company.email);
    const customerId = await this.resolveCustomerId(companyId, existing, company.name, email);
    const web = this.config.api.webPublicUrl;

    const handle = await this.provider.createCheckout({
      companyId,
      customerId,
      companyName: company.name,
      email,
      selection,
      successUrl: `${web}/billing?checkout=success`,
      cancelUrl: `${web}/payment?checkout=cancelled`,
      trialPeriodDays: this.config.payments.trialPeriodDays,
    });

    if (!handle.url) {
      throw new BusinessRuleError('Could not start checkout. Please try again.');
    }

    this.logger.log(
      `Checkout started for company ${companyId} (${selection.plan}/${selection.interval})`,
    );
    return handle;
  }

  /**
   * Confirm the subscription the provider returned the browser with.
   *
   * Closes the gap between "the payer approved" and "the webhook arrived". Those
   * are seconds apart in the good case and can be minutes apart when the
   * provider is retrying, and in between the tenant is sitting on our billing
   * page watching a spinner with a completed payment behind it. Reading the
   * subscription directly and storing what it says makes the redirect
   * deterministic rather than a race.
   *
   * It is a **read**, not a grant. Three properties make it safe to expose:
   *
   *  - The tenant comes from the authenticated session, never from the request.
   *  - The id is only used to look the subscription up at the provider; whatever
   *    comes back is the provider's word, not the caller's.
   *  - The subscription must carry *this* tenant's reference, so presenting
   *    another company's id changes nothing and reveals nothing.
   *
   * Idempotent by construction: it converges on the same row as the webhook,
   * through the same `applySubscription` path, so whichever arrives first the
   * result is identical and the second is a no-op.
   */
  async confirmCheckout(
    companyId: string,
    providerSubscriptionId: string,
  ): Promise<SubscriptionSummary> {
    const live = await this.provider.getSubscription(providerSubscriptionId);

    // The tenant reference the provider echoes back is what proves this
    // subscription is ours to apply. A mismatch is either a stale link or
    // someone trying another company's id; both get the same flat refusal.
    if (live.companyId && live.companyId !== companyId) {
      this.logger.warn(
        `Company ${companyId} tried to confirm subscription ${providerSubscriptionId}, ` +
          `which belongs to ${live.companyId}.`,
      );
      throw new NotFoundError('No such subscription.', ApiErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    // A subscription with no reference at all predates `custom_id` or was made
    // outside this application. Fall back to the stored customer, and refuse if
    // it matches nothing — never guess a tenant.
    if (!live.companyId) {
      const owner = await this.repo.findByProviderSubscriptionId(
        live.provider,
        providerSubscriptionId,
      );
      if (owner && owner.companyId !== companyId) {
        throw new NotFoundError('No such subscription.', ApiErrorCode.SUBSCRIPTION_NOT_FOUND);
      }
    }

    this.logger.log(
      `Company ${companyId} confirmed subscription ${providerSubscriptionId} (${live.status}).`,
    );
    return this.applySubscription(live, companyId);
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
  async changePlan(companyId: string, selection: PlanSelection): Promise<PlanChangeSummary> {
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

    const web = this.config.api.webPublicUrl;
    const { subscription: updated, approvalUrl } = await this.provider.changePlan({
      providerSubscriptionId: subscription.providerSubscriptionId!,
      selection,
      isUpgrade,
      returnUrl: `${web}/billing?change=success`,
      cancelUrl: `${web}/billing?change=cancelled`,
    });

    // When the provider needs the payer's consent, the change has NOT happened
    // yet — it lands when they follow the link and the resulting webhook
    // arrives. Storing the provider's answer is still right (it is the current
    // truth), but the caller must be told to send the browser onward.
    const summary = await this.applySubscription(updated);

    this.logger.log(
      `Company ${companyId} moved to ${selection.plan}/${selection.interval} ` +
        `(${isUpgrade ? 'upgrade' : 'downgrade'})${approvalUrl ? ', pending payer approval' : ''}`,
    );
    return { ...summary, approvalUrl };
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

    const reconciled = BillingService.reconcilePendingCancellation(subscription, previous);

    const row = await this.repo.upsert(companyId, {
      provider: reconciled.provider,
      providerCustomerId: reconciled.providerCustomerId,
      providerSubscriptionId: reconciled.providerSubscriptionId,
      providerPriceId: reconciled.providerPriceId,
      status: reconciled.status,
      plan: reconciled.plan,
      billingInterval: reconciled.interval,
      currentPeriodEnd: reconciled.currentPeriodEnd,
      cancelAtPeriodEnd: reconciled.cancelAtPeriodEnd,
      canceledAt: reconciled.canceledAt,
      trialEndsAt: reconciled.trialEndsAt,
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

  /**
   * Keep a subscription the tenant cancelled entitled until its term runs out.
   *
   * A provider with no scheduled cancellation has to express one some other way.
   * PayPal's is a *suspension*: billing stops, the subscription survives, and it
   * can be reinstated. But a suspension is indistinguishable on the wire from
   * one PayPal imposed after repeated payment failures, so the raw status would
   * strip a paying tenant of access the moment they clicked cancel — which is
   * neither what they asked for nor what they paid for.
   *
   * The intent lives in our own row, so that is what disambiguates it: a paused
   * subscription that we know is cancelling, whose paid term has not yet
   * elapsed, keeps the status it had. Once the term passes, the provider's word
   * stands and the sweep finalizes it.
   *
   * Static and pure so the rule is testable without a database.
   */
  static reconcilePendingCancellation(
    incoming: ProviderSubscription,
    existing: Subscription | null,
    now: Date = new Date(),
  ): ProviderSubscription {
    const isPendingCancellation =
      incoming.cancelAtPeriodEnd || Boolean(existing?.cancelAtPeriodEnd);
    if (!isPendingCancellation) return incoming;

    // Only a pause is ambiguous. A real CANCELED or EXPIRED from the provider is
    // the end of the story and must never be talked out of.
    if (incoming.status !== SubscriptionStatus.PAUSED) {
      return { ...incoming, cancelAtPeriodEnd: isPendingCancellation };
    }

    const periodEnd = incoming.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null;
    const termHasLapsed = periodEnd !== null && periodEnd <= now;

    return {
      ...incoming,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
      status: termHasLapsed
        ? SubscriptionStatus.CANCELED
        : ((existing?.status as SubscriptionStatus | undefined) ?? SubscriptionStatus.ACTIVE),
    };
  }

  /**
   * Finish the cancellations whose paid term has now elapsed.
   *
   * Run on a schedule by {@link SubscriptionSweepService}. Each row is
   * cancelled for real at the provider — under PayPal it was only suspended, and
   * a suspension left alone would sit there indefinitely — and then written down
   * as CANCELED so entitlement follows.
   *
   * Returns how many were finalized, which is what the caller logs.
   */
  async finalizeLapsedCancellations(now: Date = new Date()): Promise<number> {
    const due = await this.repo.findLapsedPendingCancellations(this.provider.provider, now);
    let finalized = 0;

    for (const subscription of due) {
      if (!subscription.providerSubscriptionId) continue;
      try {
        await this.provider.cancelImmediately(subscription.providerSubscriptionId);
        await this.repo.update(subscription.companyId, {
          status: SubscriptionStatus.CANCELED,
          canceledAt: now,
        });
        await this.redis.del(this.entitlementKey(subscription.companyId));
        finalized += 1;
        this.logger.log(
          `Finalized cancellation for company ${subscription.companyId} ` +
            `(${subscription.providerSubscriptionId}).`,
        );
      } catch (error) {
        // One tenant's failure must not abandon the rest of the batch; the next
        // run picks this row up again because nothing about it changed.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Could not finalize cancellation for company ${subscription.companyId}: ${message}`,
        );
      }
    }

    return finalized;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** The tenant record every checkout needs, or a clear 404. */
  private async requireCompany(companyId: string): Promise<{ name: string; email: string | null }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }
    return company;
  }

  /** Reuse the tenant's provider customer, creating (or replacing) it as needed. */
  private async resolveCustomerId(
    companyId: string,
    existing: Subscription | null,
    companyName: string,
    email: string,
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

    const customerId = await this.provider.createCustomer({
      companyId,
      companyName,
      email,
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
