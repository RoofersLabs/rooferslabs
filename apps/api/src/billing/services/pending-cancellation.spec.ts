/**
 * The rule that makes cancel-at-period-end work on a provider that has no
 * scheduled cancellation.
 *
 * PayPal expresses "stop billing but stay reinstatable" as a suspension, and a
 * suspension is indistinguishable on the wire from one PayPal imposed after
 * repeated payment failures. Getting this wrong in either direction is a real
 * customer-facing bug: too eager and a paying tenant is locked out the moment
 * they click cancel, too lax and a cancelled subscription never actually ends.
 */
import type { Subscription } from '@prisma/client';
import { PaymentProvider, SubscriptionStatus } from '@rooferslabs/shared';
import { BillingService } from './billing.service';
import type { ProviderSubscription } from '../types/billing.types';

const NOW = new Date('2026-08-01T12:00:00Z');
const FUTURE = new Date('2026-09-01T12:00:00Z');
const PAST = new Date('2026-07-01T12:00:00Z');

const incoming = (overrides: Partial<ProviderSubscription> = {}): ProviderSubscription => ({
  provider: PaymentProvider.PAYPAL,
  providerCustomerId: 'QYR5Z8XDVJNXQ',
  providerSubscriptionId: 'I-BW452GLLEP1G',
  providerPriceId: 'P-5ML',
  companyId: 'company_123',
  status: SubscriptionStatus.PAUSED,
  plan: null,
  interval: null,
  currentPeriodEnd: FUTURE,
  cancelAtPeriodEnd: false,
  canceledAt: null,
  trialEndsAt: null,
  ...overrides,
});

const existing = (overrides: Partial<Subscription> = {}): Subscription =>
  ({
    companyId: 'company_123',
    provider: PaymentProvider.PAYPAL,
    status: SubscriptionStatus.ACTIVE,
    cancelAtPeriodEnd: true,
    currentPeriodEnd: FUTURE,
    ...overrides,
  }) as unknown as Subscription;

const reconcile = BillingService.reconcilePendingCancellation;

describe('reconcilePendingCancellation', () => {
  it('leaves an ordinary subscription completely alone', () => {
    const event = incoming({ status: SubscriptionStatus.ACTIVE });
    expect(reconcile(event, null, NOW)).toBe(event);
  });

  /**
   * The headline case: the tenant cancelled, we suspended at PayPal, and PayPal
   * is now telling us the subscription is paused. They have paid through
   * September and must keep working until then.
   */
  it('keeps a tenant entitled after they cancel, until the term they paid for ends', () => {
    const result = reconcile(incoming(), existing(), NOW);

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toEqual(FUTURE);
  });

  it('lets the cancellation land once the paid term has lapsed', () => {
    const result = reconcile(
      incoming({ currentPeriodEnd: PAST }),
      existing({ currentPeriodEnd: PAST }),
      NOW,
    );
    expect(result.status).toBe(SubscriptionStatus.CANCELED);
  });

  /**
   * A suspension with no cancellation intent behind it is PayPal acting on its
   * own — dunning, a failed card. That must NOT be reinterpreted as still
   * active, or a tenant who stopped paying would keep full access.
   */
  it('does not rescue a suspension the tenant never asked for', () => {
    const result = reconcile(incoming(), existing({ cancelAtPeriodEnd: false }), NOW);
    expect(result.status).toBe(SubscriptionStatus.PAUSED);
  });

  it('trusts a real cancellation from the provider over any local intent', () => {
    const result = reconcile(
      incoming({ status: SubscriptionStatus.CANCELED, canceledAt: NOW }),
      existing(),
      NOW,
    );
    expect(result.status).toBe(SubscriptionStatus.CANCELED);
    expect(result.cancelAtPeriodEnd).toBe(true);
  });

  it('preserves a trial rather than flattening it to ACTIVE', () => {
    const result = reconcile(incoming(), existing({ status: SubscriptionStatus.TRIALING }), NOW);
    expect(result.status).toBe(SubscriptionStatus.TRIALING);
  });

  /**
   * PayPal drops next_billing_time on a suspended subscription, so the incoming
   * period end can be null. Falling back to the stored one is what stops the
   * tenant's remaining term from silently disappearing.
   */
  it('falls back to the stored period end when the provider stops sending one', () => {
    const result = reconcile(incoming({ currentPeriodEnd: null }), existing(), NOW);
    expect(result.currentPeriodEnd).toEqual(FUTURE);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  /**
   * With no period end from either side there is nothing to say the term is
   * still running. Defaulting to "lapsed" would cut a paying tenant off on the
   * strength of a missing field, so the safe direction is to keep access.
   */
  it('keeps access when no period end is known at all', () => {
    const result = reconcile(
      incoming({ currentPeriodEnd: null }),
      existing({ currentPeriodEnd: null }),
      NOW,
    );
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('honours an intent carried on the event itself, with no stored row yet', () => {
    const result = reconcile(incoming({ cancelAtPeriodEnd: true }), null, NOW);
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('is exactly at the boundary: a term ending now has ended', () => {
    const result = reconcile(
      incoming({ currentPeriodEnd: NOW }),
      existing({ currentPeriodEnd: NOW }),
      NOW,
    );
    expect(result.status).toBe(SubscriptionStatus.CANCELED);
  });
});
