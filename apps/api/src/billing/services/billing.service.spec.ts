import type { Invoice, Subscription } from '@prisma/client';
import {
  BillingInterval,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@rooferslabs/shared';
import { BusinessRuleError, NotFoundError } from '../../common/exceptions/domain.exception';
import { BillingService } from './billing.service';
import type { BillingProvider } from '../interfaces/billing-provider.interface';
import type { BillingRepository } from '../repositories/billing.repository';
import type { InvoiceRepository } from '../repositories/invoice.repository';
import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../redis/redis.service';
import type { CompaniesService } from '../../companies/companies.service';
import type { ProviderSubscription } from '../types/billing.types';

const COMPANY = 'company_1';
const CUSTOMER = 'ctm_123';
const SUB = 'sub_123';
const PRICE_STARTER = 'pri_starter';

function makeRow(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'row_1',
    companyId: COMPANY,
    provider: PaymentProvider.PADDLE,
    providerCustomerId: CUSTOMER,
    providerSubscriptionId: SUB,
    providerPriceId: PRICE_STARTER,
    status: SubscriptionStatus.ACTIVE,
    plan: SubscriptionPlan.STARTER,
    billingInterval: BillingInterval.MONTH,
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subscription;
}

function makeProviderSubscription(
  overrides: Partial<ProviderSubscription> = {},
): ProviderSubscription {
  return {
    provider: PaymentProvider.PADDLE,
    providerCustomerId: CUSTOMER,
    providerSubscriptionId: SUB,
    providerPriceId: PRICE_STARTER,
    companyId: COMPANY,
    status: SubscriptionStatus.ACTIVE,
    plan: SubscriptionPlan.STARTER,
    interval: BillingInterval.MONTH,
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    ...overrides,
  };
}

function makeService(
  options: {
    existing?: Subscription | null;
    byCustomer?: Subscription | null;
    bySubscription?: Subscription | null;
    upserted?: Subscription;
    cached?: boolean | null;
    company?: { name: string; email: string | null; createdAt?: Date } | null;
    user?: { email: string } | null;
    paymentsEnabled?: boolean;
    provider?: PaymentProvider;
    grandfatherBefore?: Date | null;
    invoices?: Invoice[];
  } = {},
) {
  const repo = {
    findByCompanyId: jest.fn().mockResolvedValue(options.existing ?? null),
    findByProviderCustomerId: jest.fn().mockResolvedValue(options.byCustomer ?? null),
    findByProviderSubscriptionId: jest.fn().mockResolvedValue(options.bySubscription ?? null),
    create: jest.fn().mockResolvedValue(makeRow()),
    update: jest.fn().mockResolvedValue(makeRow()),
    upsert: jest.fn().mockResolvedValue(options.upserted ?? makeRow()),
  } as unknown as jest.Mocked<BillingRepository>;

  const invoiceRepo = {
    listByCompanyId: jest.fn().mockResolvedValue(options.invoices ?? []),
    sync: jest.fn().mockResolvedValue({} as Invoice),
  } as unknown as jest.Mocked<InvoiceRepository>;

  const provider = {
    provider: options.provider ?? PaymentProvider.PADDLE,
    isConfigured: true,
    createCustomer: jest.fn().mockResolvedValue(CUSTOMER),
    customerExists: jest.fn().mockResolvedValue(true),
    createCheckout: jest.fn().mockResolvedValue({
      provider: PaymentProvider.PADDLE,
      url: 'https://pay.example.com/?_ptxn=txn_1',
      transactionId: 'txn_1',
    }),
    createPortalSession: jest.fn().mockResolvedValue({ url: 'https://portal.example.com' }),
    getSubscription: jest.fn().mockResolvedValue(makeProviderSubscription()),
    changePlan: jest.fn().mockResolvedValue(makeProviderSubscription()),
    cancelAtPeriodEnd: jest
      .fn()
      .mockResolvedValue(makeProviderSubscription({ cancelAtPeriodEnd: true })),
    resumeSubscription: jest
      .fn()
      .mockResolvedValue(makeProviderSubscription({ cancelAtPeriodEnd: false })),
    listInvoices: jest.fn().mockResolvedValue([]),
    priceIdFor: jest.fn().mockReturnValue(PRICE_STARTER),
    planForPriceId: jest
      .fn()
      .mockReturnValue({ plan: SubscriptionPlan.STARTER, interval: BillingInterval.MONTH }),
    verifyAndParseWebhook: jest.fn(),
  } as unknown as jest.Mocked<BillingProvider>;

  const config = {
    payments: {
      enabled: options.paymentsEnabled ?? true,
      provider: options.provider ?? PaymentProvider.PADDLE,
      trialPeriodDays: 0,
      grandfatherBefore: options.grandfatherBefore ?? null,
    },
    paddle: { clientToken: 'test_token', environment: 'sandbox' },
    api: { webPublicUrl: 'https://app.example.com' },
  } as unknown as AppConfigService;

  const prisma = {
    company: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.company === undefined
            ? { name: 'Acme Roofing', email: 'billing@acme.test', createdAt: new Date() }
            : options.company,
        ),
    },
    user: { findFirst: jest.fn().mockResolvedValue(options.user ?? null) },
  } as unknown as PrismaService;

  const redis = {
    get: jest.fn().mockResolvedValue(options.cached ?? null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<RedisService>;

  const companies = {
    provisionReceptionistNumber: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CompaniesService>;

  const service = new BillingService(provider, repo, invoiceRepo, config, prisma, redis, companies);
  return { service, repo, invoiceRepo, provider, redis, companies, prisma };
}

describe('BillingService — entitlement', () => {
  it('treats every tenant as entitled while payments are disabled', async () => {
    // The wall is down: nobody should be blocked, and no lookup should happen.
    const { service, repo } = makeService({ paymentsEnabled: false });
    await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
    expect(repo.findByCompanyId).not.toHaveBeenCalled();
  });

  it('reads the flag before the cache so flipping it takes effect at once', async () => {
    const { service, redis } = makeService({ paymentsEnabled: false, cached: false });
    await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('entitles ACTIVE and TRIALING, and nothing else', async () => {
    for (const status of [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]) {
      const { service } = makeService({ existing: makeRow({ status }) });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
    }
    for (const status of [
      SubscriptionStatus.PAST_DUE,
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.PAUSED,
      SubscriptionStatus.NONE,
    ]) {
      const { service } = makeService({ existing: makeRow({ status }) });
      await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(false);
    }
  });

  it('exempts a company created before the grandfather cutoff', async () => {
    const { service } = makeService({
      existing: null,
      company: { name: 'Old Co', email: null, createdAt: new Date('2020-01-01') },
      grandfatherBefore: new Date('2026-01-01'),
    });
    await expect(service.hasActiveSubscription(COMPANY)).resolves.toBe(true);
  });

  it('makes getSummary agree with hasActiveSubscription for a grandfathered tenant', async () => {
    // If these two disagreed the client and the API would take opposite views
    // of who may enter the application, and the browser would bounce.
    const options = {
      existing: null,
      company: { name: 'Old Co', email: null, createdAt: new Date('2020-01-01') },
      grandfatherBefore: new Date('2026-01-01'),
    };
    const a = makeService(options);
    const b = makeService(options);
    const summary = await a.service.getSummary(COMPANY);
    expect(summary.isActive).toBe(await b.service.hasActiveSubscription(COMPANY));
    expect(summary.isActive).toBe(true);
    // The real status is still reported — the exemption grants access, it does
    // not invent a subscription.
    expect(summary.status).toBe(SubscriptionStatus.NONE);
  });
});

describe('BillingService — checkout', () => {
  it('refuses a second subscription for an already-active tenant', async () => {
    const { service, provider } = makeService({ existing: makeRow() });
    await expect(
      service.createCheckout(COMPANY, {
        plan: SubscriptionPlan.STARTER,
        interval: BillingInterval.MONTH,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('reuses an existing provider customer rather than creating another', async () => {
    const { service, provider } = makeService({
      existing: makeRow({ status: SubscriptionStatus.CANCELED }),
    });
    await service.createCheckout(COMPANY, {
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
    expect(provider.createCustomer).not.toHaveBeenCalled();
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: CUSTOMER }),
    );
  });

  it('creates a fresh customer when the stored one belongs to another provider', async () => {
    // A row left over from Stripe names a customer that does not exist in
    // Paddle; reusing the id would fail at the provider.
    const { service, provider } = makeService({
      existing: makeRow({ provider: PaymentProvider.STRIPE, status: SubscriptionStatus.CANCELED }),
    });
    await service.createCheckout(COMPANY, {
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
    expect(provider.customerExists).not.toHaveBeenCalled();
    expect(provider.createCustomer).toHaveBeenCalled();
  });

  it('replaces a customer that no longer exists at the provider', async () => {
    const { service, provider } = makeService({
      existing: makeRow({ status: SubscriptionStatus.CANCELED }),
    });
    provider.customerExists.mockResolvedValue(false);
    await service.createCheckout(COMPANY, {
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
    expect(provider.createCustomer).toHaveBeenCalled();
  });

  it('falls back to the owner email when the company has none', async () => {
    // Paddle requires an email; our schema does not. A receipt still has to go
    // somewhere, and the first user is the person who signed the company up.
    const { service, provider } = makeService({
      existing: null,
      company: { name: 'Acme', email: null },
      user: { email: 'owner@acme.test' },
    });
    await service.createCheckout(COMPANY, {
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
    expect(provider.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@acme.test' }),
    );
  });

  it('asks for an email rather than guessing when none exists at all', async () => {
    const { service } = makeService({
      existing: null,
      company: { name: 'Acme', email: null },
      user: null,
    });
    await expect(
      service.createCheckout(COMPANY, {
        plan: SubscriptionPlan.STARTER,
        interval: BillingInterval.MONTH,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('passes the plan through and never a price', async () => {
    // The client names a plan; the price is resolved server-side. This is what
    // stops a tampered request from checking out at a price we did not offer.
    const { service, provider } = makeService({ existing: null });
    await service.createCheckout(COMPANY, {
      plan: SubscriptionPlan.PROFESSIONAL,
      interval: BillingInterval.MONTH,
    });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { plan: SubscriptionPlan.PROFESSIONAL, interval: BillingInterval.MONTH },
        companyId: COMPANY,
      }),
    );
  });
});

describe('BillingService — lifecycle', () => {
  it('refuses to manage a subscription created by a different provider', async () => {
    // Its identifiers mean nothing to the active processor.
    const { service, provider } = makeService({
      existing: makeRow({ provider: PaymentProvider.STRIPE }),
    });
    await expect(service.cancelSubscription(COMPANY)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(provider.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('requires a subscription before cancelling', async () => {
    const { service } = makeService({ existing: null });
    await expect(service.cancelSubscription(COMPANY)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to cancel twice', async () => {
    const { service, provider } = makeService({ existing: makeRow({ cancelAtPeriodEnd: true }) });
    await expect(service.cancelSubscription(COMPANY)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(provider.cancelAtPeriodEnd).not.toHaveBeenCalled();
  });

  it('refuses to resume a subscription that is not ending', async () => {
    const { service, provider } = makeService({ existing: makeRow({ cancelAtPeriodEnd: false }) });
    await expect(service.resumeSubscription(COMPANY)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(provider.resumeSubscription).not.toHaveBeenCalled();
  });

  it('treats a move to a higher plan as an upgrade', async () => {
    const { service, provider } = makeService({
      existing: makeRow({ plan: SubscriptionPlan.STARTER }),
    });
    await service.changePlan(COMPANY, {
      plan: SubscriptionPlan.PROFESSIONAL,
      interval: BillingInterval.MONTH,
    });
    expect(provider.changePlan).toHaveBeenCalledWith(expect.objectContaining({ isUpgrade: true }));
  });

  it('treats a move to a lower plan as a downgrade', async () => {
    // Downgrades must not bill immediately — the tenant has already paid for
    // the term it is on.
    const { service, provider } = makeService({
      existing: makeRow({ plan: SubscriptionPlan.PROFESSIONAL }),
    });
    await service.changePlan(COMPANY, {
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
    expect(provider.changePlan).toHaveBeenCalledWith(expect.objectContaining({ isUpgrade: false }));
  });

  it('refuses a change to the plan the tenant is already on', async () => {
    const { service, provider } = makeService({ existing: makeRow() });
    await expect(
      service.changePlan(COMPANY, {
        plan: SubscriptionPlan.STARTER,
        interval: BillingInterval.MONTH,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(provider.changePlan).not.toHaveBeenCalled();
  });
});

describe('BillingService — synchronization', () => {
  it('provisions a phone number on the transition into active', async () => {
    const { service, companies } = makeService({
      existing: null,
      byCustomer: null,
      upserted: makeRow({ status: SubscriptionStatus.ACTIVE }),
    });
    await service.applySubscription(makeProviderSubscription());
    expect(companies.provisionReceptionistNumber).toHaveBeenCalledWith(COMPANY);
  });

  it('does not re-provision when the tenant was already active', async () => {
    // Providers redeliver, and send several events that all describe an
    // already-active subscription. Provisioning is guarded on the transition.
    const { service, companies } = makeService({
      existing: makeRow({ status: SubscriptionStatus.ACTIVE }),
      byCustomer: makeRow({ status: SubscriptionStatus.ACTIVE }),
      upserted: makeRow({ status: SubscriptionStatus.ACTIVE }),
    });
    await service.applySubscription(makeProviderSubscription());
    expect(companies.provisionReceptionistNumber).not.toHaveBeenCalled();
  });

  it('invalidates the entitlement cache on every state change', async () => {
    const { service, redis } = makeService({ existing: null, byCustomer: null });
    await service.applySubscription(makeProviderSubscription());
    expect(redis.del).toHaveBeenCalledWith(`billing:active:${COMPANY}`);
  });

  it('ignores a subscription it cannot attribute to a tenant', async () => {
    // Normal when a sandbox and a production account share a webhook target.
    const { service, repo, companies } = makeService({ existing: null, byCustomer: null });
    const summary = await service.applySubscription(makeProviderSubscription({ companyId: null }));
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(companies.provisionReceptionistNumber).not.toHaveBeenCalled();
    expect(summary.status).toBe(SubscriptionStatus.NONE);
  });

  it('prefers the stored customer mapping over the echoed reference', async () => {
    // The stored mapping is ours and cannot be spoofed by payload contents.
    const { service, repo } = makeService({
      byCustomer: makeRow({ companyId: 'company_real' }),
      existing: makeRow({ companyId: 'company_real' }),
    });
    await service.applySubscription(makeProviderSubscription({ companyId: 'company_claimed' }));
    expect(repo.upsert).toHaveBeenCalledWith('company_real', expect.anything());
  });

  it('stores the provider alongside its identifiers', async () => {
    const { service, repo } = makeService({ existing: null, byCustomer: null });
    await service.applySubscription(makeProviderSubscription());
    expect(repo.upsert).toHaveBeenCalledWith(
      COMPANY,
      expect.objectContaining({
        provider: PaymentProvider.PADDLE,
        providerCustomerId: CUSTOMER,
        providerSubscriptionId: SUB,
      }),
    );
  });

  it('drops an invoice it cannot attribute rather than guessing an owner', async () => {
    const { service, invoiceRepo } = makeService({ byCustomer: null, bySubscription: null });
    await service.applyInvoice({
      provider: PaymentProvider.PADDLE,
      providerInvoiceId: 'txn_orphan',
      providerCustomerId: 'ctm_unknown',
      providerSubscriptionId: null,
      number: null,
      status: InvoiceStatus.PAID,
      currency: 'USD',
      amountDue: 29900,
      amountPaid: 29900,
      issuedAt: new Date(),
      paidAt: new Date(),
      invoiceUrl: null,
    });
    expect(invoiceRepo.sync).not.toHaveBeenCalled();
  });
});

describe('BillingService — public config', () => {
  it('exposes the client token but never a secret', () => {
    const { service } = makeService();
    const config = service.getPublicConfig();
    expect(config).toEqual({
      provider: PaymentProvider.PADDLE,
      clientToken: 'test_token',
      environment: 'sandbox',
    });
    expect(JSON.stringify(config)).not.toMatch(/api[_-]?key|secret/i);
  });

  it('reports no client token when the active provider has no browser SDK', () => {
    const { service } = makeService({ provider: PaymentProvider.STRIPE });
    expect(service.getPublicConfig().clientToken).toBe('');
  });
});

describe('BillingService — summary shape', () => {
  it('names no payment processor anywhere in the client-facing payload', () => {
    // The frontend must not be able to tell which provider is in use; that is
    // what makes swapping one invisible to the UI.
    const summary = BillingService.toSummary(makeRow());
    expect(JSON.stringify(summary)).not.toMatch(/paddle|stripe/i);
    expect(summary.hasBillingAccount).toBe(true);
  });

  it('reports a tenant with no row as NONE and inactive', () => {
    const summary = BillingService.toSummary(null);
    expect(summary.status).toBe(SubscriptionStatus.NONE);
    expect(summary.isActive).toBe(false);
    expect(summary.hasBillingAccount).toBe(false);
  });
});
