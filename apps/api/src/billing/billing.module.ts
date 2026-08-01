import { Module, type Provider, type Type } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CompaniesModule } from '../companies/companies.module';
import { activePaymentProvider, isPaymentsEnabled } from '../config/payments.flag';
import { BillingController } from './billing.controller';
import { PROVIDER_ADAPTERS } from './provider-adapters';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';
import { BILLING_PROVIDER } from './interfaces/billing-provider.interface';
import { BillingProvisioningModule } from './provisioning/billing-provisioning.module';
import { BillingRepository } from './repositories/billing.repository';
import { InvoiceRepository } from './repositories/invoice.repository';
import { WebhookEventRepository } from './repositories/webhook-event.repository';
import { BillingService } from './services/billing.service';
import { SubscriptionSweepService } from './services/subscription-sweep.service';
import { WebhookProcessorService } from './services/webhook-processor.service';

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
 * The sweep that finalizes cancel-at-period-end, registered only when billing
 * is on.
 *
 * With payments disabled there is no subscription to cancel and no provider
 * client to cancel it with, so an hourly job would be pure noise — and would
 * construct the very adapter the disabled flag promises is never constructed.
 */
const scheduledServices: Provider[] = isPaymentsEnabled() ? [SubscriptionSweepService] : [];

/**
 * Billing.
 *
 * Exactly one adapter is registered — the dormant one has a row in
 * `provider-adapters.ts` and is compiled, but is never listed as a provider, so
 * Nest never constructs it and nothing in the running process holds a reference
 * to it. That is what makes "Stripe is disabled" a structural fact rather than a
 * convention.
 *
 * BillingProvisioningModule supplies the PayPal transport and the catalogue
 * repository. Importing it rather than redeclaring those providers is what makes
 * the running API and `billing:paypal:setup` resolve the same classes.
 *
 * CompaniesModule is imported for phone-number provisioning on subscription
 * activation; it has no imports of its own, so no cycle.
 *
 * BillingController stays registered whatever the configuration and answers 503
 * via PaymentsEnabledGuard, so a client gets a clear reason rather than a 404.
 */
@Module({
  imports: [CompaniesModule, BillingProvisioningModule, ScheduleModule.forRoot()],
  controllers: [BillingController, ...webhookControllers],
  providers: [
    ...(active.collaborators ?? []),
    active.adapter,
    { provide: BILLING_PROVIDER, useExisting: active.adapter },
    BillingService,
    WebhookProcessorService,
    BillingRepository,
    InvoiceRepository,
    WebhookEventRepository,
    PaymentsEnabledGuard,
    ...scheduledServices,
  ],
  exports: [BillingService],
})
export class BillingModule {}
