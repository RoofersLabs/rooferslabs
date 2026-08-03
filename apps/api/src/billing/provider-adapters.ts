/**
 * The adapter and webhook route for each processor.
 *
 * This table is the entire cost of supporting a payment provider. Adding one
 * means writing an adapter against {@link BillingProvider} and adding a row
 * here — no service, controller, repository, or page changes.
 *
 * Typing it as a total `Record<PaymentProvider, …>` means the compiler refuses
 * a new member of the enum until it has an implementation, so the two can never
 * drift apart.
 *
 * It lives in its own file, apart from `billing.module.ts`, because it is data
 * about classes rather than a wiring decision. Reading it should not drag in the
 * module graph — and therefore should not boot configuration validation, open a
 * database, or require a PayPal credential. That is what lets the test which
 * asserts the table is complete run as a plain unit test.
 */
import type { Provider, Type } from '@nestjs/common';
import { PaymentProvider } from '@rooferslabs/shared';
import type { BillingProvider } from './interfaces/billing-provider.interface';
import { PayPalPlans } from './providers/paypal/paypal.plans';
import { PayPalProvider } from './providers/paypal/paypal.provider';
import { PayPalSubscriptions } from './providers/paypal/paypal.subscriptions';
import { PayPalWebhookVerifier } from './providers/paypal/paypal.webhook';
import { PayPalWebhookController } from './webhooks/paypal-webhook.controller';

export interface ProviderAdapter {
  adapter: Type<BillingProvider>;
  webhookController: Type<unknown>;
  /**
   * Collaborators the adapter injects. Registered only when its provider is the
   * active one, so a dormant adapter's dependencies are never constructed
   * either — the same guarantee the adapter itself gets.
   *
   * PayPal's shared clients (the transport, the catalogue repository) are not
   * here: they come from BillingProvisioningModule, which the setup command
   * also uses, so both resolve the same instances.
   */
  collaborators?: Provider[];
}

export const PROVIDER_ADAPTERS: Record<PaymentProvider, ProviderAdapter> = {
  [PaymentProvider.PAYPAL]: {
    adapter: PayPalProvider,
    webhookController: PayPalWebhookController,
    collaborators: [PayPalPlans, PayPalSubscriptions, PayPalWebhookVerifier],
  },
};
