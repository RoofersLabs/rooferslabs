import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { CompaniesModule } from '../companies/companies.module';
import { ReceptionistModule } from '../receptionist/receptionist.module';
import { MediaStreamBridge } from './media-stream.bridge';
import { PhoneNumbersRepository } from './phone-numbers.repository';
import { PhoneNumbersService } from './phone-numbers.service';
import { TelephonyController } from './telephony.controller';
import { TwilioService } from './twilio.service';

/**
 * Telephony layer: Twilio voice webhooks, phone-number management, and the
 * Media Streams ↔ OpenAI Realtime bridge (M6). The bridge is exported so the
 * HTTP server bootstrap can attach the raw WebSocket upgrade handler.
 */
@Module({
  imports: [CallsModule, ReceptionistModule, CompaniesModule],
  controllers: [TelephonyController],
  providers: [TwilioService, PhoneNumbersService, PhoneNumbersRepository, MediaStreamBridge],
  exports: [MediaStreamBridge, PhoneNumbersService],
})
export class TelephonyModule {}
