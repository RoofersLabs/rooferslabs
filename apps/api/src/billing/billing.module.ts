import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * CompaniesModule is imported for phone-number provisioning on subscription
 * activation. It provides no imports of its own, so this introduces no cycle.
 */
@Module({
  imports: [CompaniesModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, BillingRepository, StripeService],
  exports: [BillingService],
})
export class BillingModule {}
