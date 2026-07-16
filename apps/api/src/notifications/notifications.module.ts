import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
