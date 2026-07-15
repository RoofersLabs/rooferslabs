import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CompaniesModule } from '../companies/companies.module';
import { ReceptionistService } from './receptionist.service';

/**
 * AI receptionist module: session configuration, live tool execution, and
 * post-call structured analysis. Consumed by the telephony (M6) and call
 * pipeline (M7) layers.
 */
@Module({
  imports: [AiModule, CompaniesModule],
  providers: [ReceptionistService],
  exports: [ReceptionistService],
})
export class ReceptionistModule {}
