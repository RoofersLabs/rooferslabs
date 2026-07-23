import type { Subscription } from '@prisma/client';
import type Stripe from 'stripe';
import { SubscriptionPlan, SubscriptionStatus } from '@rooferslabs/shared';
import { BusinessRuleError, NotFoundError } from '../common/exceptions/domain.exception';
import { BillingService } from './billing.service';
import type { BillingRepository } from './billing.repository';
import type { StripeService } from './stripe.service';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

const COMPANY = 'company_1';
const CUSTOMER = 'cus_123';
const SUB = 'sub_123';
const PRICE_STARTER = 'price_starter';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_row_1',
    companyId: COMPANY,
    stripeCustomerId: CUSTOMER,
    stripeSubscriptionId: SUB,
    stripePriceId: PRICE_STARTER,
    status: SubscriptionStatus.ACTIVE,
    plan: SubscriptionPlan.STARTER,
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subscription;
}

/** Minimal Stripe subscription shaped like the Basil API (period on the item). */
function makeStripeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: SUB,
    customer: CUSTOMER,
    status: 'active',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    metadata: { companyId: COMPANY },
    items: {
      data: [{ price: { id: PRICE_STARTER }, current_period_end: 1785000000 }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function makeService(
  overrides: {
    existing?: Subscription | null;
    byCustomer?: Subscription | null;
    upsert?: Subscription;
    stripeSubscription?: Stripe.Subscription;
    cached?: boolean | null;
  } = {},
) {
  const repo = {
    findByCompanyId: jest.fn().mockResolvedValue(overrides.existing ?? null),
    findByStripeCustomerId: jest.fn().mockResolvedValue(overrides.byCustomer ?? null),
    findByStripeSubscriptionId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(makeSubscription()),
    update: jest.fn().mockResolvedValue(makeSubscription()),
  } as unknown as jest.Mocked<BillingRepository>;

  const stripe = {
    priceIdFor: jest.fn().mockReturnValue(PRICE_STARTER),
    planForPriceId: jest.fn().mockReturnValue(SubscriptionPlan.STARTER),
    createCustomer: jest.fn().mockResolvedValue(CUSTOMER),
    customerExists: jest.fn().mockResolvedValue(true),
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }),
    createBillingPortalSession: jest
      .fn()
      .mockResolvedValue({ url: 'https://billing.stripe.com/p/session/1' }),
    retrieveSubscription: jest
      .fn()
      .mockResolvedValue(overrides.stripeSubscription ?? makeStripeSubscription()),
    cancelAtPeriodEnd: jest
      .fn()
      .mockResolvedValue(makeStripeSubscription({ cancel_at_period_end: true })),
    resumeSubscription: jest.fn().mockResolvedValue(makeStripeSubscription()),
  } as unknown as jest.Mocked<StripeService>;

  const config = {
    api: { webPublicUrl: 'https://app.rooferslabs.com' },
    stripe: { trialPeriodDays: 0 },
  } as unknown as AppConfigService;

  const prisma = {
    subscription: {
      upsert: jest.fn().mockResolvedValue(overrides.upsert ?? makeSubscription()),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Acme Roofing', email: 'a@acme.com' }),
    },
  } as unknown as PrismaService;

  const redis = {
    get: jest.fn().mockResolvedValue(overrides.cached ?? null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<RedisService>;

  const service = new BillingService(repo, stripe, config, prisma, redis);
  return { service, repo, stripe, prisma, redis };
}

describe('BillingService', () => {
  describe('entitlement', () => {
    it('denies access when the tenant has never subscribed', async () => {
      const { service } = makeService({ existing: null });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(false);
    });

    it('grants access while active', async () => {
      const { service } = makeService({ existing: makeSubscription() });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
    });

    it('grants access during a trial', async () => {
      const { service } = makeService({
        existing: makeSubscription({ status: SubscriptionStatus.TRIALING }),
      });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
    });

    it.each([
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.UNPAID,
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.INCOMPLETE,
      SubscriptionStatus.INCOMPLETE_EXPIRED,
      SubscriptionStatus.PAUSED,
    ])('denies access when %s', async (status) => {
      const { service } = makeService({ existing: makeSubscription({ status }) });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(false);
    });

    it('serves the cached answer without touching the database', async () => {
      const { service, repo } = makeService({ cached: true });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
      expect(repo.findByCompanyId).not.toHaveBeenCalled();
    });
  });

  describe('checkout', () => {
    it('creates a customer on first checkout and returns the hosted URL', async () => {
      const { service, stripe, repo } = makeService({ existing: null });
      const result = await service.createCheckoutSession(COMPANY, SubscriptionPlan.STARTER);

      expect(stripe.createCustomer).toHaveBeenCalledWith({
        companyId: COMPANY,
        companyName: 'Acme Roofing',
        email: 'a@acme.com',
      });
      expect(repo.create).toHaveBeenCalled();
      expect(result.url).toContain('checkout.stripe.com');
    });

    it('reuses an existing Stripe customer instead of creating a duplicate', async () => {
      const { service, stripe } = makeService({
        existing: makeSubscription({ status: SubscriptionStatus.CANCELED }),
      });
      await service.createCheckoutSession(COMPANY, SubscriptionPlan.STARTER);
      expect(stripe.createCustomer).not.toHaveBeenCalled();
    });

    it('refuses a second subscription while one is already active', async () => {
      const { service } = makeService({ existing: makeSubscription() });
      await expect(
        service.createCheckoutSession(COMPANY, SubscriptionPlan.STARTER),
      ).rejects.toBeInstanceOf(BusinessRuleError);
    });
  });

  describe('portal & lifecycle', () => {
    it('rejects a portal session for a tenant with no billing account', async () => {
      const { service } = makeService({ existing: null });
      await expect(service.createBillingPortalSession(COMPANY)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('cancels at period end rather than immediately', async () => {
      const { service, stripe } = makeService({ existing: makeSubscription() });
      await service.cancelSubscription(COMPANY);
      expect(stripe.cancelAtPeriodEnd).toHaveBeenCalledWith(SUB);
    });

    it('refuses to resume a subscription that is not scheduled to cancel', async () => {
      const { service } = makeService({ existing: makeSubscription() });
      await expect(service.resumeSubscription(COMPANY)).rejects.toBeInstanceOf(BusinessRuleError);
    });

    it('resumes a subscription that is scheduled to cancel', async () => {
      const { service, stripe } = makeService({
        existing: makeSubscription({ cancelAtPeriodEnd: true }),
        stripeSubscription: makeStripeSubscription({ cancel_at_period_end: true }),
      });
      await service.resumeSubscription(COMPANY);
      expect(stripe.resumeSubscription).toHaveBeenCalledWith(SUB);
    });
  });

  describe('webhooks', () => {
    const event = (type: string, object: unknown): Stripe.Event =>
      ({ id: 'evt_1', type, data: { object } }) as Stripe.Event;

    it('activates the tenant on checkout.session.completed', async () => {
      const { service, prisma } = makeService({ byCustomer: null });
      await service.applyWebhookEvent(
        event('checkout.session.completed', {
          subscription: SUB,
          client_reference_id: COMPANY,
        }),
      );

      const upsert = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
      expect(upsert.where).toEqual({ companyId: COMPANY });
      expect(upsert.create.status).toBe(SubscriptionStatus.ACTIVE);
      // Basil moved the billing period onto the subscription item.
      expect(upsert.create.currentPeriodEnd).toEqual(new Date(1785000000 * 1000));
    });

    it('mirrors a cancellation from customer.subscription.deleted', async () => {
      const { service, prisma } = makeService({ byCustomer: makeSubscription() });
      await service.applyWebhookEvent(
        event(
          'customer.subscription.deleted',
          makeStripeSubscription({ status: 'canceled', canceled_at: 1785000000 }),
        ),
      );

      const upsert = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
      expect(upsert.update.status).toBe(SubscriptionStatus.CANCELED);
    });

    it('marks the tenant past due when an invoice payment fails', async () => {
      const { service, prisma } = makeService({
        byCustomer: makeSubscription(),
        stripeSubscription: makeStripeSubscription({ status: 'past_due' }),
      });
      await service.applyWebhookEvent(
        event('invoice.payment_failed', {
          parent: { subscription_details: { subscription: SUB } },
        }),
      );

      const upsert = (prisma.subscription.upsert as jest.Mock).mock.calls[0][0];
      expect(upsert.update.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it('invalidates the cached entitlement whenever state changes', async () => {
      const { service, redis } = makeService({ byCustomer: makeSubscription() });
      await service.applyWebhookEvent(
        event('customer.subscription.updated', makeStripeSubscription()),
      );
      expect(redis.del).toHaveBeenCalledWith(`billing:active:${COMPANY}`);
    });

    it('ignores an event that cannot be matched to a tenant', async () => {
      const { service, prisma } = makeService({ byCustomer: null });
      await service.applyWebhookEvent(
        event('customer.subscription.updated', makeStripeSubscription({ metadata: {} })),
      );
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('ignores unrelated event types', async () => {
      const { service, prisma } = makeService();
      await service.applyWebhookEvent(event('payment_intent.succeeded', {}));
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });
  });
});
