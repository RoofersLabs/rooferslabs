import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Probes. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
