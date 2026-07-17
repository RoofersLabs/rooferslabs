import { Module } from '@nestjs/common';
import { CallsRepository } from '../calls/calls.repository';
import { PhoneNumbersRepository } from '../telephony/phone-numbers.repository';
import { PhoneNumbersService } from '../telephony/phone-numbers.service';
import { TwilioService } from '../telephony/twilio.service';
import { CompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';

/**
 * PhoneNumbersService (+ its repo and the stateless Twilio adapter) is
 * provided here directly rather than importing TelephonyModule, which would
 * create a module cycle (telephony → calls → receptionist → companies).
 * Same precedent as TwilioService inside CallsModule.
 */
@Module({
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    CompaniesRepository,
    PhoneNumbersService,
    PhoneNumbersRepository,
    TwilioService,
    CallsRepository,
  ],
  exports: [CompaniesService],
})
export class CompaniesModule {}
