import { Module, type Type } from '@nestjs/common';
import { PaymentProvider } from '@rooferslabs/shared';
import { CompaniesModule } from '../companies/companies.module';
import { activePaymentProvider, isPaymentsEnabled } from '../config/payments.flag';
import { BillingController } from './billing.controller';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';
import { BILLING_PROVIDER, type BillingProvider } from './interfaces/billing-provider.interface';
import { PaddleProvider } from './providers/paddle/paddle.provider';
import { StripeProvider } from './providers/stripe/stripe.provider';
import { BillingRepository } from './repositories/billing.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { WebhookEventRepository } from './repositories/webhook-event.repository';
import { BillingService } from './services/billing.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { PaddleWebhookController } from './webhooks/paddle-webhook.controller';
import { StripeWebhookController } from './webhooks/stripe-webhook.controller';

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
 */
const PROVIDER_ADAPTERS: Record<
  PaymentProvider,
  { adapter: Type<BillingProvider>; webhookController: Type<unknown> }
> = {
  [PaymentProvider.PADDLE]: {
    adapter: PaddleProvider,
    webhookController: PaddleWebhookController,
  },
  [PaymentProvider.STRIPE]: {
    adapter: StripeProvider,
    webhookController: StripeWebhookController,
  },
};

/**
 * The provider this process bills through, resolved once at module construction.
 *
 * Read straight from the environment rather than from AppConfigService because
 * both decisions below are made while this module's decorator is evaluated,
 * before the DI container exists. AppConfigModule is imported ahead of
 * BillingModule in AppModule, so ConfigModule has already loaded .env by this
 * point and the two always agree.
 */
const active = PROVIDER_ADAPTERS[activePaymentProvider()];

/**
 * Only the active provider's webhook route is registered.
 *
 * A dormant provider's route does not exist rather than existing and rejecting:
 * a stray or misdirected delivery gets an unambiguous 404, and no unreachable
 * signature-verification path is left exposed. With payments off entirely,
 * neither is mounted.
 */
const webhookControllers: Type<unknown>[] = isPaymentsEnabled() ? [active.webhookController] : [];

/**
 * Billing.
 *
 * Exactly one adapter is registered — the dormant one is imported for its type
 * and its place in the table above, but is never listed as a provider, so Nest
 * never constructs it and nothing in the running process holds a reference to
 * it. That is what makes "Stripe is disabled" a structural fact rather than a
 * convention.
 *
 * CompaniesModule is imported for phone-number provisioning on subscription
 * activation; it has no imports of its own, so no cycle.
 *
 * BillingController stays registered whatever the configuration and answers 503
 * via PaymentsEnabledGuard, so a client gets a clear reason rather than a 404.
 */
@Module({
  imports: [CompaniesModule],
  controllers: [BillingController, ...webhookControllers],
  providers: [
    active.adapter,
    { provide: BILLING_PROVIDER, useExisting: active.adapter },
    BillingService,
    WebhookProcessorService,
    BillingRepository,
    InvoiceRepository,
    WebhookEventRepository,
    PaymentsEnabledGuard,
  ],
  exports: [BillingService],
})
export class BillingModule {}

/** Exported for the test that asserts every provider has an implementation. */
export { PROVIDER_ADAPTERS };
