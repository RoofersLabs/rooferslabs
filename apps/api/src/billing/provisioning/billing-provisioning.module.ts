/**
 * Billing provisioning, as a module that can stand on its own.
 *
 * Deliberately narrow: config, Prisma, and the PayPal clients. Nothing else.
 * That is what lets `billing:paypal:setup` boot a Nest context in about a second
 * without opening a Redis connection, a Twilio client or an OpenAI socket — none
 * of which a provisioning run needs, and any of which could hang it.
 *
 * BillingModule imports this rather than redeclaring the providers, so the
 * running API and the setup command resolve exactly the same classes.
 */
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PayPalCatalog } from '../providers/paypal/paypal.catalog';
import { PayPalClient } from '../providers/paypal/paypal.client';
import { PayPalWebhooksAdmin } from '../providers/paypal/paypal.webhooks-admin';
import { BillingCatalogRepository } from './billing-catalog.repository';
import { BillingReadinessService } from './billing-readiness.service';
import { PayPalProvisioningService } from './paypal-provisioning.service';

@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [
    PayPalClient,
    PayPalCatalog,
    PayPalWebhooksAdmin,
    BillingCatalogRepository,
    BillingReadinessService,
    PayPalProvisioningService,
  ],
  exports: [
    PayPalClient,
    BillingCatalogRepository,
    BillingReadinessService,
    PayPalProvisioningService,
  ],
})
export class BillingProvisioningModule {}
