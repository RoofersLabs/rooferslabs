import type {
  Subscription as PaddleSubscription,
  Transaction as PaddleTransaction,
} from '@paddle/paddle-node-sdk';
import { BillingInterval, InvoiceStatus, SubscriptionStatus } from '@rooferslabs/shared';
import {
  companyIdFromCustomData,
  toBillingInterval,
  toMinorUnits,
  toProviderInvoice,
  toProviderSubscription,
  toStatus,
} from './paddle.mapper';

/** A Paddle subscription shaped like the real API response. */
function makePaddleSubscription(overrides: Partial<PaddleSubscription> = {}): PaddleSubscription {
  return {
    id: 'sub_01',
    status: 'active',
    customerId: 'ctm_01',
    canceledAt: null,
    customData: { companyId: 'company_1' },
    billingCycle: { interval: 'month', frequency: 1 },
    currentBillingPeriod: {
      startsAt: '2026-07-01T00:00:00Z',
      endsAt: '2026-08-01T00:00:00Z',
    },
    scheduledChange: null,
    items: [{ price: { id: 'pri_starter' }, trialDates: null }],
    ...overrides,
  } as unknown as PaddleSubscription;
}

function makePaddleTransaction(overrides: Partial<PaddleTransaction> = {}): PaddleTransaction {
  return {
    id: 'txn_01',
    status: 'completed',
    customerId: 'ctm_01',
    subscriptionId: 'sub_01',
    invoiceNumber: 'INV-0001',
    currencyCode: 'usd',
    billedAt: '2026-07-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z',
    details: { totals: { total: '25000', grandTotal: '29900' } },
    ...overrides,
  } as unknown as PaddleTransaction;
}

describe('paddle.mapper — status', () => {
  it('maps every Paddle status onto our enum', () => {
    expect(toStatus('active')).toBe(SubscriptionStatus.ACTIVE);
    expect(toStatus('trialing')).toBe(SubscriptionStatus.TRIALING);
    expect(toStatus('past_due')).toBe(SubscriptionStatus.PAST_DUE);
    expect(toStatus('paused')).toBe(SubscriptionStatus.PAUSED);
    expect(toStatus('canceled')).toBe(SubscriptionStatus.CANCELED);
  });

  it('degrades an unknown status to NONE rather than granting access', () => {
    // Fail closed: a status we do not recognize must never read as entitled.
    expect(toStatus('something_new')).toBe(SubscriptionStatus.NONE);
    expect(toStatus(null)).toBe(SubscriptionStatus.NONE);
  });
});

describe('paddle.mapper — billing interval', () => {
  it('reads Paddle’s interval/frequency pair', () => {
    expect(toBillingInterval({ interval: 'month', frequency: 1 })).toBe(BillingInterval.MONTH);
    expect(toBillingInterval({ interval: 'year', frequency: 1 })).toBe(BillingInterval.YEAR);
  });

  it('treats a twelve-month cadence as annual', () => {
    // Paddle can express a yearly plan either way; both are annual to us.
    expect(toBillingInterval({ interval: 'month', frequency: 12 })).toBe(BillingInterval.YEAR);
  });

  it('returns null when there is no cycle to read', () => {
    expect(toBillingInterval(null)).toBeNull();
  });
});

describe('paddle.mapper — subscription', () => {
  it('normalizes the fields the domain stores', () => {
    const result = toProviderSubscription(makePaddleSubscription());
    expect(result).toMatchObject({
      providerCustomerId: 'ctm_01',
      providerSubscriptionId: 'sub_01',
      providerPriceId: 'pri_starter',
      companyId: 'company_1',
      status: SubscriptionStatus.ACTIVE,
      interval: BillingInterval.MONTH,
      cancelAtPeriodEnd: false,
    });
    expect(result.currentPeriodEnd).toEqual(new Date('2026-08-01T00:00:00Z'));
  });

  it('reads a pending cancellation from the scheduled change', () => {
    // Paddle keeps the subscription `active` and records the intent separately,
    // so a flag read off `status` alone would miss it entirely.
    const result = toProviderSubscription(
      makePaddleSubscription({
        scheduledChange: {
          action: 'cancel',
          effectiveAt: '2026-08-01T00:00:00Z',
          resumeAt: null,
        },
      } as Partial<PaddleSubscription>),
    );
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('treats a scheduled pause as an ending subscription too', () => {
    // From the tenant's point of view access stops either way.
    const result = toProviderSubscription(
      makePaddleSubscription({
        scheduledChange: { action: 'pause', effectiveAt: '2026-08-01T00:00:00Z', resumeAt: null },
      } as Partial<PaddleSubscription>),
    );
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it('does not flag a scheduled resume as a cancellation', () => {
    const result = toProviderSubscription(
      makePaddleSubscription({
        scheduledChange: { action: 'resume', effectiveAt: '2026-08-01T00:00:00Z', resumeAt: null },
      } as Partial<PaddleSubscription>),
    );
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('carries the trial end date through', () => {
    const result = toProviderSubscription(
      makePaddleSubscription({
        items: [
          {
            price: { id: 'pri_starter' },
            trialDates: { startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-07-15T00:00:00Z' },
          },
        ],
      } as unknown as Partial<PaddleSubscription>),
    );
    expect(result.trialEndsAt).toEqual(new Date('2026-07-15T00:00:00Z'));
  });
});

describe('paddle.mapper — tenant reference', () => {
  it('reads the company we attached at checkout', () => {
    expect(companyIdFromCustomData({ companyId: 'company_9' })).toBe('company_9');
  });

  it('returns null for anything that is not a usable reference', () => {
    expect(companyIdFromCustomData(null)).toBeNull();
    expect(companyIdFromCustomData({})).toBeNull();
    expect(companyIdFromCustomData({ companyId: '' })).toBeNull();
    expect(companyIdFromCustomData({ companyId: 42 })).toBeNull();
    expect(companyIdFromCustomData('company_9')).toBeNull();
  });
});

describe('paddle.mapper — money', () => {
  it('parses minor units as integers, never floats', () => {
    expect(toMinorUnits('29900')).toBe(29900);
    expect(toMinorUnits(null)).toBe(0);
    expect(toMinorUnits('not a number')).toBe(0);
  });

  it('bills the grand total, which includes tax', () => {
    // `total` is pre-tax and would understate what the customer actually paid.
    const invoice = toProviderInvoice(makePaddleTransaction());
    expect(invoice.amountDue).toBe(29900);
    expect(invoice.amountPaid).toBe(29900);
  });

  it('records nothing as paid until the transaction completes', () => {
    const invoice = toProviderInvoice(makePaddleTransaction({ status: 'billed' } as never));
    expect(invoice.status).toBe(InvoiceStatus.OPEN);
    expect(invoice.amountDue).toBe(29900);
    expect(invoice.amountPaid).toBe(0);
    expect(invoice.paidAt).toBeNull();
  });

  it('normalizes the currency code to uppercase', () => {
    expect(toProviderInvoice(makePaddleTransaction()).currency).toBe('USD');
  });
});
