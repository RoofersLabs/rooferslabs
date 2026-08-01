import { Module } from '@nestjs/common';
import { BillingProvisioningModule } from '../billing/provisioning/billing-provisioning.module';
import { HealthController } from './health.controller';

/**
 * Probes.
 *
 * Imports the provisioning module for `BillingReadinessService` rather than
 * BillingModule, so a health check never pulls in the provider adapter, the
 * webhook route or the cancellation sweep — and so `/health/billing` answers
 * even when payments are switched off entirely.
 */
@Module({
  imports: [BillingProvisioningModule],
  controllers: [HealthController],
})
export class HealthModule {}
