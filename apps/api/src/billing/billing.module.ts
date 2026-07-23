import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, BillingRepository, StripeService],
  exports: [BillingService],
})
export class BillingModule {}
