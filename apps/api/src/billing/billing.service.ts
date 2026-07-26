import { Injectable, Logger } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type Stripe from 'stripe';
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  ApiErrorCode,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@rooferslabs/shared';
import { BusinessRuleError, NotFoundError } from '../common/exceptions/domain.exception';
import { CompaniesService } from '../companies/companies.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BillingRepository } from './billing.repository';
import { StripeService } from './stripe.service';

/** The billing view the frontend renders and gates on. */
export interface SubscriptionSummary {
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  /** True when the tenant may use the application right now. */
  isActive: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
  hasStripeCustomer: boolean;
}

/** Stripe subscription statuses → our persisted enum. */
const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  unpaid: SubscriptionStatus.UNPAID,
  paused: SubscriptionStatus.PAUSED,
};

const toDate = (seconds: number | null | undefined): Date | null =>
  typeof seconds === 'number' ? new Date(seconds * 1000) : null;

/**
 * Subscription lifecycle for a tenant.
 *
 * Stripe remains the source of truth; every state transition arrives through a
 * verified webhook and is mirrored into the local `subscriptions` row, which is
 * what request-time authorization reads. Checkout and portal sessions are
 * created here so no secret ever reaches the browser.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  /** Short TTL: a webhook invalidates explicitly, this only bounds the blast
   *  radius of a missed invalidation (e.g. while Redis was down). */
  private readonly entitlementTtl = 60;

  constructor(
    private readonly repo: BillingRepository,
    private readonly stripe: StripeService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly companies: CompaniesService,
  ) {}

  private entitlementKey(companyId: string): string {
    return `billing:active:${companyId}`;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  /** The tenant's billing state; a tenant that never started checkout gets NONE. */
  async getSummary(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.repo.findByCompanyId(companyId);
    const summary = BillingService.toSummary(subscription);

    // A grandfathered tenant keeps its real Stripe status — it genuinely has no
    // subscription — but reads as entitled, so the frontend guard lets it into
    // the application instead of bouncing it to /payment. This must agree with
    // hasActiveSubscription() or the client and the API would disagree about
    // who is allowed in.
    if (!summary.isActive && (await this.isGrandfathered(companyId))) {
      return { ...summary, isActive: true };
    }
    return summary;
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
    const cutoff = this.config.stripe.grandfatherBefore;
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
        isActive: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEndsAt: null,
        hasStripeCustomer: false,
      };
    }
    const status = subscription.status as SubscriptionStatus;
    return {
      status,
      plan: (subscription.plan as SubscriptionPlan | null) ?? null,
      isActive: ACTIVE_SUBSCRIPTION_STATUSES.includes(status),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      hasStripeCustomer: true,
    };
  }

  // ── Checkout & portal ────────────────────────────────────────────────────

  /**
   * Start Stripe Checkout for a plan, returning the hosted URL to redirect to.
   * The Stripe customer is created on first use and reused thereafter, so a
   * tenant never accumulates duplicate customers across retries.
   */
  async createCheckoutSession(companyId: string, plan: SubscriptionPlan): Promise<{ url: string }> {
    const existing = await this.repo.findByCompanyId(companyId);
    if (existing && ACTIVE_SUBSCRIPTION_STATUSES.includes(existing.status as SubscriptionStatus)) {
      throw new BusinessRuleError(
        'This account already has an active subscription. Use the billing portal to change plans.',
      );
    }

    const customerId = await this.resolveCustomerId(companyId, existing);
    const web = this.config.api.webPublicUrl;

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId: this.stripe.priceIdFor(plan),
      companyId,
      successUrl: `${web}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${web}/payment?checkout=cancelled`,
      trialPeriodDays: this.config.stripe.trialPeriodDays,
    });

    if (!session.url) {
      throw new BusinessRuleError('Stripe did not return a checkout URL. Please try again.');
    }
    this.logger.log(`Checkout session ${session.id} created for company ${companyId} (${plan})`);
    return { url: session.url };
  }

  /** Open the hosted Customer Portal for payment methods, invoices, and plan changes. */
  async createBillingPortalSession(companyId: string): Promise<{ url: string }> {
    const subscription = await this.repo.findByCompanyId(companyId);
    if (!subscription) {
      throw new NotFoundError(
        'No billing account exists yet. Start a subscription first.',
        ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }
    const session = await this.stripe.createBillingPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${this.config.api.webPublicUrl}/billing`,
    });
    return { url: session.url };
  }

  // ── Lifecycle actions ────────────────────────────────────────────────────

  /**
   * Cancel at period end. Access continues until the paid term expires, and no
   * customer data is ever deleted — the tenant simply loses access afterwards.
   */
  async cancelSubscription(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireStripeSubscription(companyId);
    const updated = await this.stripe.cancelAtPeriodEnd(subscription.stripeSubscriptionId!);
    this.logger.log(`Subscription ${updated.id} set to cancel at period end (${companyId})`);
    return this.syncFromStripeSubscription(updated);
  }

  /** Undo a pending cancellation while the subscription is still running. */
  async resumeSubscription(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.requireStripeSubscription(companyId);
    const current = await this.stripe.retrieveSubscription(subscription.stripeSubscriptionId!);
    if (!current.cancel_at_period_end) {
      throw new BusinessRuleError('This subscription is not scheduled for cancellation.');
    }
    const updated = await this.stripe.resumeSubscription(subscription.stripeSubscriptionId!);
    this.logger.log(`Subscription ${updated.id} resumed (${companyId})`);
    return this.syncFromStripeSubscription(updated);
  }

  // ── Webhook state synchronization ────────────────────────────────────────

  /**
   * Apply a verified Stripe event to the local read-model. Handlers are
   * idempotent: Stripe retries deliveries, and events can arrive out of order.
   */
  async applyWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // The subscription is fetched fresh rather than trusting the session
        // snapshot, so the stored period/status reflect Stripe right now.
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) break;
        const subscription = await this.stripe.retrieveSubscription(subscriptionId);
        await this.syncFromStripeSubscription(subscription, session.client_reference_id);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.syncFromStripeSubscription(event.data.object);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const subscriptionId = BillingService.subscriptionIdFromInvoice(event.data.object);
        if (!subscriptionId) break;
        const subscription = await this.stripe.retrieveSubscription(subscriptionId);
        await this.syncFromStripeSubscription(subscription);
        break;
      }

      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
    }
  }

  /** In the Basil API the owning subscription hangs off `invoice.parent`. */
  private static subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
    const details = invoice.parent?.subscription_details;
    if (!details) return null;
    return typeof details.subscription === 'string'
      ? details.subscription
      : (details.subscription?.id ?? null);
  }

  /**
   * Mirror a Stripe subscription into the local row. The tenant is resolved from
   * subscription metadata (set at checkout), falling back to the Stripe customer
   * id, so an event is never applied to the wrong company.
   */
  private async syncFromStripeSubscription(
    subscription: Stripe.Subscription,
    fallbackCompanyId?: string | null,
  ): Promise<SubscriptionSummary> {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    const existing = await this.repo.findByStripeCustomerId(customerId);
    const companyId =
      existing?.companyId ?? subscription.metadata?.companyId ?? fallbackCompanyId ?? null;

    if (!companyId) {
      this.logger.warn(
        `Stripe subscription ${subscription.id} could not be matched to a company — ignoring.`,
      );
      return BillingService.toSummary(null);
    }

    // Read the tenant's state before the upsert so activation can be detected
    // as a transition rather than a level — Stripe redelivers events and sends
    // several that all describe an already-active subscription.
    const previous = await this.repo.findByCompanyId(companyId);
    const wasActive = previous
      ? ACTIVE_SUBSCRIPTION_STATUSES.includes(previous.status as SubscriptionStatus)
      : false;

    const item = subscription.items.data[0];
    const priceId = item?.price?.id ?? null;
    const data = {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: STATUS_MAP[subscription.status] ?? SubscriptionStatus.NONE,
      plan: this.stripe.planForPriceId(priceId),
      currentPeriodEnd: toDate(item?.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: toDate(subscription.canceled_at),
      trialEndsAt: toDate(subscription.trial_end),
    };

    const row = await this.prisma.subscription.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
    // Entitlement changed — the next gated request must re-read it.
    await this.redis.del(this.entitlementKey(companyId));

    this.logger.log(
      `Subscription for company ${companyId} is now ${row.status} (${subscription.id})`,
    );

    // First moment this tenant is entitled to service: buy its dedicated AI
    // number. This used to happen when onboarding completed, but onboarding now
    // runs before payment, so provisioning there would purchase a real number
    // for tenants who finish setup and never subscribe.
    //
    // Guarded on the transition so redelivered events never re-run it, and the
    // call itself is both idempotent and non-throwing — a Twilio failure must
    // not fail the webhook, or Stripe would retry the entire event.
    const isNowActive = ACTIVE_SUBSCRIPTION_STATUSES.includes(row.status as SubscriptionStatus);
    if (isNowActive && !wasActive) {
      await this.companies.provisionReceptionistNumber(companyId);
    }

    return BillingService.toSummary(row);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Reuse the tenant's Stripe customer, creating (or replacing) it as needed. */
  private async resolveCustomerId(
    companyId: string,
    existing: Subscription | null,
  ): Promise<string> {
    if (existing && (await this.stripe.customerExists(existing.stripeCustomerId))) {
      return existing.stripeCustomerId;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true },
    });
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }

    const customerId = await this.stripe.createCustomer({
      companyId,
      companyName: company.name,
      email: company.email,
    });

    if (existing) {
      await this.repo.update(companyId, { stripeCustomerId: customerId });
    } else {
      await this.repo.create({
        companyId,
        stripeCustomerId: customerId,
        status: SubscriptionStatus.NONE,
      });
    }
    await this.redis.del(this.entitlementKey(companyId));
    return customerId;
  }

  private async requireStripeSubscription(companyId: string): Promise<Subscription> {
    const subscription = await this.repo.findByCompanyId(companyId);
    if (!subscription?.stripeSubscriptionId) {
      throw new NotFoundError(
        'No subscription to manage. Start a subscription first.',
        ApiErrorCode.SUBSCRIPTION_NOT_FOUND,
      );
    }
    return subscription;
  }
}
