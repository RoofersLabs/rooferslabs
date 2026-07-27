import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { isPaymentsEnabled } from '../config/payments.flag';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * Billing. CompaniesModule is imported for phone-number provisioning on
 * subscription activation; it has no imports of its own, so no cycle.
 *
 * The Stripe webhook route is registered only while PAYMENTS_ENABLED is on, so
 * with payments off the endpoint does not exist rather than existing and
 * rejecting. That is why the flag is read from the environment here instead of
 * from AppConfigService: controller registration is decided when this decorator
 * is evaluated, before the DI container exists. AppConfigModule is imported
 * ahead of BillingModule in AppModule, so ConfigModule has already loaded .env
 * by this point and the two always agree.
 *
 * BillingController stays registered either way and answers 503 via
 * PaymentsEnabledGuard, so a client gets a clear reason rather than a 404.
 */
@Module({
  imports: [CompaniesModule],
  controllers: isPaymentsEnabled()
    ? [BillingController, StripeWebhookController]
    : [BillingController],
  providers: [BillingService, BillingRepository, StripeService, PaymentsEnabledGuard],
  exports: [BillingService],
})
export class BillingModule {}
