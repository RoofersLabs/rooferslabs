import { InvoiceStatus, PaymentProvider, SubscriptionStatus } from '@rooferslabs/shared';
import {
  isTrialing,
  saleToProviderInvoice,
  toCustomerId,
  toDate,
  toInvoiceStatus,
  toMinorUnits,
  toProviderSubscription,
  toStatus,
} from './paypal.mapper';
import type { PayPalSubscription } from './paypal.types';

const subscription = (overrides: Partial<PayPalSubscription> = {}): PayPalSubscription => ({
  id: 'I-BW452GLLEP1G',
  plan_id: 'P-5ML4271244454362WXNWU5NQ',
  status: 'ACTIVE',
  custom_id: 'company_123',
  subscriber: { payer_id: 'QYR5Z8XDVJNXQ' },
  billing_info: { next_billing_time: '2026-09-01T10:00:00Z' },
  ...overrides,
});

describe('toStatus', () => {
  it.each([
    ['ACTIVE', SubscriptionStatus.ACTIVE],
    ['SUSPENDED', SubscriptionStatus.PAUSED],
    ['CANCELLED', SubscriptionStatus.CANCELED],
    ['EXPIRED', SubscriptionStatus.CANCELED],
  ])('maps %s to %s', (paypal, expected) => {
    expect(toStatus(paypal)).toBe(expected);
  });

  /**
   * The pre-approval states are the ones that matter most: a subscription
   * exists at PayPal from the moment it is created, but nothing has been paid
   * and nobody has agreed to anything. Mapping either to ACTIVE would let a
   * tenant into the product by starting a checkout and walking away.
   */
  it.each(['APPROVAL_PENDING', 'APPROVED'])('never grants access for %s', (paypal) => {
    expect(toStatus(paypal)).toBe(SubscriptionStatus.INCOMPLETE);
  });

  it('falls back to NONE rather than guessing at an unknown status', () => {
    expect(toStatus('SOMETHING_NEW')).toBe(SubscriptionStatus.NONE);
    expect(toStatus(null)).toBe(SubscriptionStatus.NONE);
  });
});

describe('toMinorUnits', () => {
  /**
   * PayPal sends decimal strings where the domain stores integer cents. Getting
   * this wrong is a hundredfold billing error in one direction or the other.
   */
  it('converts a decimal string to cents', () => {
    expect(toMinorUnits('49.00')).toBe(4900);
    expect(toMinorUnits('7')).toBe(700);
  });

  it('rounds rather than truncates, so .99 amounts survive the float', () => {
    // 49.99 * 100 is 4998.999... in IEEE 754; a floor would bill a cent less.
    expect(toMinorUnits('49.99')).toBe(4999);
    expect(toMinorUnits('0.07')).toBe(7);
  });

  it('treats a missing or unparseable amount as zero', () => {
    expect(toMinorUnits(undefined)).toBe(0);
    expect(toMinorUnits('')).toBe(0);
    expect(toMinorUnits('not-a-number')).toBe(0);
  });
});

describe('toDate', () => {
  it('parses RFC 3339 and rejects nonsense', () => {
    expect(toDate('2026-09-01T10:00:00Z')?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
    expect(toDate('never')).toBeNull();
    expect(toDate(null)).toBeNull();
  });
});

describe('isTrialing', () => {
  it('is true only while a trial cycle still has cycles left', () => {
    const trialing = subscription({
      billing_info: {
        cycle_executions: [
          { tenure_type: 'TRIAL', sequence: 1, cycles_completed: 0, cycles_remaining: 1 },
        ],
      },
    });
    expect(isTrialing(trialing)).toBe(true);
  });

  it('is false once the trial is spent', () => {
    const spent = subscription({
      billing_info: {
        cycle_executions: [
          { tenure_type: 'TRIAL', sequence: 1, cycles_completed: 1, cycles_remaining: 0 },
          { tenure_type: 'REGULAR', sequence: 2, cycles_completed: 3 },
        ],
      },
    });
    expect(isTrialing(spent)).toBe(false);
  });

  it('is false when there was never a trial', () => {
    expect(isTrialing(subscription())).toBe(false);
  });
});

describe('toCustomerId', () => {
  it('prefers the payer id PayPal reports', () => {
    expect(toCustomerId(subscription())).toBe('QYR5Z8XDVJNXQ');
  });

  /**
   * Before approval there is no payer, and the column is NOT NULL. Falling back
   * to the subscription id keeps the row writable and stays unique, which is all
   * the column is used for.
   */
  it('falls back to the subscription id before anyone has approved', () => {
    expect(toCustomerId(subscription({ subscriber: undefined }))).toBe('I-BW452GLLEP1G');
  });
});

describe('toProviderSubscription', () => {
  it('carries the tenant reference through custom_id', () => {
    expect(toProviderSubscription(subscription()).companyId).toBe('company_123');
  });

  it('reports TRIALING while a trial cycle is running, not plain ACTIVE', () => {
    const trialing = subscription({
      billing_info: {
        next_billing_time: '2026-09-01T10:00:00Z',
        cycle_executions: [
          { tenure_type: 'TRIAL', sequence: 1, cycles_completed: 0, cycles_remaining: 1 },
        ],
      },
    });
    const mapped = toProviderSubscription(trialing);
    expect(mapped.status).toBe(SubscriptionStatus.TRIALING);
    expect(mapped.trialEndsAt?.toISOString()).toBe('2026-09-01T10:00:00.000Z');
  });

  /**
   * PayPal stops sending next_billing_time once a subscription is cancelled or
   * suspended. Without the fallback a cancel-at-period-end would lose the very
   * date that decides how long access lasts.
   */
  it('falls back to final_payment_time when there is no next billing time', () => {
    const suspended = subscription({
      status: 'SUSPENDED',
      billing_info: { final_payment_time: '2026-10-01T10:00:00Z' },
    });
    expect(toProviderSubscription(suspended).currentPeriodEnd?.toISOString()).toBe(
      '2026-10-01T10:00:00.000Z',
    );
  });

  /**
   * The wire cannot carry our cancellation intent — PayPal only knows a
   * subscription is suspended, not why. Reporting `false` unconditionally would
   * clobber the flag every time a webhook arrived.
   */
  it('never invents a cancellation intent from the payload', () => {
    expect(toProviderSubscription(subscription()).cancelAtPeriodEnd).toBe(false);
    expect(toProviderSubscription(subscription(), true).cancelAtPeriodEnd).toBe(true);
  });

  it('leaves plan and interval for the adapter, which holds the catalogue', () => {
    const mapped = toProviderSubscription(subscription());
    expect(mapped.plan).toBeNull();
    expect(mapped.interval).toBeNull();
    expect(mapped.providerPriceId).toBe('P-5ML4271244454362WXNWU5NQ');
  });

  it('records a cancellation time only when actually cancelled', () => {
    expect(toProviderSubscription(subscription()).canceledAt).toBeNull();
    const cancelled = subscription({
      status: 'CANCELLED',
      status_update_time: '2026-08-15T09:00:00Z',
    });
    expect(toProviderSubscription(cancelled).canceledAt?.toISOString()).toBe(
      '2026-08-15T09:00:00.000Z',
    );
  });
});

describe('saleToProviderInvoice', () => {
  it('attributes a payment to its subscription and converts the amount', () => {
    const invoice = saleToProviderInvoice({
      id: '5TY05013RG002845M',
      state: 'completed',
      amount: { total: '49.00', currency: 'usd' },
      billing_agreement_id: 'I-BW452GLLEP1G',
      create_time: '2026-08-01T10:00:00Z',
    });

    expect(invoice).toMatchObject({
      provider: PaymentProvider.PAYPAL,
      providerInvoiceId: '5TY05013RG002845M',
      providerSubscriptionId: 'I-BW452GLLEP1G',
      status: InvoiceStatus.PAID,
      currency: 'USD',
      amountDue: 4900,
      amountPaid: 4900,
    });
    expect(invoice.paidAt?.toISOString()).toBe('2026-08-01T10:00:00.000Z');
  });

  it('records nothing as paid when the sale did not complete', () => {
    const invoice = saleToProviderInvoice({
      id: 'S-1',
      state: 'denied',
      amount: { total: '49.00', currency: 'USD' },
      billing_agreement_id: 'I-1',
    });
    expect(invoice.status).toBe(InvoiceStatus.UNCOLLECTIBLE);
    expect(invoice.amountDue).toBe(4900);
    expect(invoice.amountPaid).toBe(0);
    expect(invoice.paidAt).toBeNull();
  });
});

describe('toInvoiceStatus', () => {
  it('is case-insensitive, because PayPal is inconsistent about it', () => {
    expect(toInvoiceStatus('completed')).toBe(InvoiceStatus.PAID);
    expect(toInvoiceStatus('COMPLETED')).toBe(InvoiceStatus.PAID);
  });

  it('treats a refund as void rather than paid', () => {
    expect(toInvoiceStatus('REFUNDED')).toBe(InvoiceStatus.VOID);
  });
});
