import { PaymentProvider } from '@rooferslabs/shared';
import { PROVIDER_ADAPTERS } from './provider-adapters';
import { PayPalPlans } from './providers/paypal/paypal.plans';
import { PayPalProvider } from './providers/paypal/paypal.provider';
import { PayPalSubscriptions } from './providers/paypal/paypal.subscriptions';
import { PayPalWebhookVerifier } from './providers/paypal/paypal.webhook';
import { StripeProvider } from './providers/stripe/stripe.provider';
import { PayPalWebhookController } from './webhooks/paypal-webhook.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';

/**
 * The provider table is the entire cost of supporting a processor, so it is
 * worth asserting that it stays complete and correctly wired. A missing entry
 * would not be a compile error at the *use* site — it would be an undefined
 * adapter at boot.
 */
describe('Provider table', () => {
  it('has an implementation for every provider the enum declares', () => {
    // Adding a member to PaymentProvider without an adapter would otherwise
    // surface as a crash on the first request rather than here.
    for (const provider of Object.values(PaymentProvider)) {
      expect(PROVIDER_ADAPTERS[provider]).toBeDefined();
      expect(PROVIDER_ADAPTERS[provider].adapter).toBeDefined();
      expect(PROVIDER_ADAPTERS[provider].webhookController).toBeDefined();
    }
  });

  it('pairs each provider with its own adapter and webhook route', () => {
    // A crossed wiring here would verify inbound webhooks against the wrong
    // provider, which fails in a way that is very hard to read from the logs.
    expect(PROVIDER_ADAPTERS[PaymentProvider.PAYPAL]).toEqual({
      adapter: PayPalProvider,
      webhookController: PayPalWebhookController,
      collaborators: [PayPalPlans, PayPalSubscriptions, PayPalWebhookVerifier],
    });
    expect(PROVIDER_ADAPTERS[PaymentProvider.STRIPE]).toEqual({
      adapter: StripeProvider,
      webhookController: StripeWebhookController,
    });
  });

  it('gives every provider a distinct adapter', () => {
    const adapters = Object.values(PROVIDER_ADAPTERS).map((entry) => entry.adapter);
    expect(new Set(adapters).size).toBe(adapters.length);
  });

  /**
   * A collaborator the adapter injects but the module never registers is a
   * runtime DI failure at boot, not a compile error — exactly the class of bug
   * this table exists to prevent.
   */
  it('registers every collaborator the active adapter needs', () => {
    const paypal = PROVIDER_ADAPTERS[PaymentProvider.PAYPAL];
    expect(paypal.collaborators).toHaveLength(3);
    expect(new Set(paypal.collaborators).size).toBe(paypal.collaborators?.length);
  });
});
