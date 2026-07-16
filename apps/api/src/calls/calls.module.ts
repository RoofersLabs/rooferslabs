import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceptionistModule } from '../receptionist/receptionist.module';
import { TwilioService } from '../telephony/twilio.service';
import { CallProcessingService } from './call-processing.service';
import { CallsController } from './calls.controller';
import { CallsRepository } from './calls.repository';
import { CallsService } from './calls.service';
import { ConversationsRepository } from './conversations.repository';

/**
 * Calls & conversations domain: read APIs plus the {@link CallProcessingService}
 * pipeline that the telephony layer (M6) drives to turn a completed call into
 * structured business data.
 *
 * TwilioService (a stateless adapter over AppConfigService) is provided here
 * directly rather than importing TelephonyModule, which would create a module
 * cycle — TelephonyModule already imports CallsModule.
 */
@Module({
  imports: [ReceptionistModule, CustomersModule, NotificationsModule],
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsRepository,
    ConversationsRepository,
    CallProcessingService,
    TwilioService,
  ],
  exports: [CallProcessingService, CallsService, ConversationsRepository, CallsRepository],
})
export class CallsModule {}
