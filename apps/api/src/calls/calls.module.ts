import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceptionistModule } from '../receptionist/receptionist.module';
import { CallProcessingService } from './call-processing.service';
import { CallsController } from './calls.controller';
import { CallsRepository } from './calls.repository';
import { CallsService } from './calls.service';
import { ConversationsRepository } from './conversations.repository';

/**
 * Calls & conversations domain: read APIs plus the {@link CallProcessingService}
 * pipeline that the telephony layer (M6) drives to turn a completed call into
 * structured business data.
 */
@Module({
  imports: [ReceptionistModule, CustomersModule, NotificationsModule],
  controllers: [CallsController],
  providers: [CallsService, CallsRepository, ConversationsRepository, CallProcessingService],
  exports: [CallProcessingService, CallsService, ConversationsRepository, CallsRepository],
})
export class CallsModule {}
