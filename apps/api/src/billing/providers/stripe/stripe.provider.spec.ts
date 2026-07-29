import { PaymentProvider, SubscriptionPlan, BillingInterval } from '@rooferslabs/shared';
import { BillingProviderDisabledError } from '../../../common/exceptions/domain.exception';
import type { AppConfigService } from '../../../config/app-config.service';
import { StripeProvider } from './stripe.provider';

/**
 * The dormancy contract.
 *
 * These tests are the executable half of the promise that Stripe is preserved
 * but inactive. They are deliberately about *refusal*, not about Stripe's
 * behaviour: the point is that nothing can transact through a provider the
 * platform has not selected, however it is reached.
 */
function makeProvider(active: boolean, secretKey = 'sk_test_123') {
  const config = {
    payments: {
      enabled: true,
      provider: active ? PaymentProvider.STRIPE : PaymentProvider.PADDLE,
      trialPeriodDays: 0,
      grandfatherBefore: null,
    },
    stripe: {
      secretKey,
      webhookSecret: 'whsec_123',
      prices: {
        [SubscriptionPlan.STARTER]: { MONTH: 'price_starter', YEAR: '' },
        [SubscriptionPlan.PROFESSIONAL]: { MONTH: 'price_pro', YEAR: '' },
      },
    },
  } as unknown as AppConfigService;
  return new StripeProvider(config);
}

const selection = { plan: SubscriptionPlan.STARTER, interval: BillingInterval.MONTH };

describe('StripeProvider — dormant while Paddle is active', () => {
  const dormant = () => makeProvider(false);

  it('reports itself as unconfigured even when a key is present', () => {
    // A key on disk must not read as "ready to bill".
    expect(dormant().isConfigured).toBe(false);
  });

  it.each([
    [
      'createCustomer',
      (p: StripeProvider) =>
        p.createCustomer({ companyId: 'c', companyName: 'n', email: 'e@x.test' }),
    ],
    [
      'createCheckout',
      (p: StripeProvider) =>
        p.createCheckout({
          companyId: 'c',
          customerId: 'cus',
          selection,
          successUrl: 'https://x',
          cancelUrl: 'https://y',
          trialPeriodDays: 0,
        }),
    ],
    [
      'createPortalSession',
      (p: StripeProvider) =>
        p.createPortalSession({ customerId: 'cus', subscriptionId: null, returnUrl: 'https://x' }),
    ],
    ['getSubscription', (p: StripeProvider) => p.getSubscription('sub_1')],
    [
      'changePlan',
      (p: StripeProvider) =>
        p.changePlan({ providerSubscriptionId: 'sub_1', selection, isUpgrade: true }),
    ],
    ['cancelAtPeriodEnd', (p: StripeProvider) => p.cancelAtPeriodEnd('sub_1')],
    ['resumeSubscription', (p: StripeProvider) => p.resumeSubscription('sub_1')],
    ['listInvoices', (p: StripeProvider) => p.listInvoices('cus', 10)],
  ])('refuses %s rather than reaching Stripe', async (_name, call) => {
    await expect(call(dormant())).rejects.toBeInstanceOf(BillingProviderDisabledError);
  });

  it('refuses to verify a webhook, so a stale endpoint cannot be driven', async () => {
    await expect(
      dormant().verifyAndParseWebhook({
        rawBody: Buffer.from('{}'),
        headers: { 'stripe-signature': 't=1,v1=abc' },
      }),
    ).rejects.toBeInstanceOf(BillingProviderDisabledError);
  });

  it('answers false from customerExists instead of throwing', () => {
    // The interface promises this one degrades rather than raises, so a lookup
    // failure never becomes a 500 on a page that merely asked a question.
    return expect(dormant().customerExists('cus_1')).resolves.toBe(false);
  });

  it('still resolves prices — the catalogue needs no network', () => {
    // Dormancy is about not transacting, not about being unreadable.
    expect(dormant().priceIdFor(selection)).toBe('price_starter');
    expect(dormant().planForPriceId('price_pro')).toEqual({
      plan: SubscriptionPlan.PROFESSIONAL,
      interval: BillingInterval.MONTH,
    });
  });
});

describe('StripeProvider — when selected', () => {
  it('reports itself configured once a key is present', () => {
    expect(makeProvider(true).isConfigured).toBe(true);
  });

  it('reports itself unconfigured while the key is missing', () => {
    expect(makeProvider(true, '').isConfigured).toBe(false);
  });

  it('identifies itself as Stripe so rows are stamped correctly', () => {
    expect(makeProvider(true).provider).toBe(PaymentProvider.STRIPE);
  });

  it('refuses a price that is not configured rather than inventing one', () => {
    // How "annual is not launched yet" surfaces.
    expect(() =>
      makeProvider(true).priceIdFor({
        plan: SubscriptionPlan.STARTER,
        interval: BillingInterval.YEAR,
      }),
    ).toThrow(/No Stripe price is configured/);
  });
});
