import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { paginated, respond } from '../common/response';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import {
  NotificationQueryDto,
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get('push/public-key')
  @ApiOperation({
    summary: 'Get the Web Push VAPID public key (null when push is not configured)',
  })
  getPushPublicKey() {
    return respond(
      { publicKey: this.push.publicKey, enabled: this.push.isEnabled },
      'Push configuration retrieved.',
    );
  }

  @Post('push/subscriptions')
  @ApiOperation({ summary: 'Register this browser for Web Push notifications' })
  async subscribePush(
    @CurrentCompanyId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePushSubscriptionDto,
  ) {
    await this.push.saveSubscription(companyId, user.id, dto);
    return respond({ subscribed: true }, 'Push subscription saved.');
  }

  @Post('push/unsubscribe')
  @ApiOperation({ summary: 'Remove this browser’s Web Push subscription' })
  async unsubscribePush(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RemovePushSubscriptionDto,
  ) {
    await this.push.removeSubscription(user.id, dto.endpoint);
    return respond({ subscribed: false }, 'Push subscription removed.');
  }

  @Get()
  @ApiOperation({ summary: 'List notifications' })
  async list(@CurrentCompanyId() companyId: string, @Query() query: NotificationQueryDto) {
    const { items, pagination, unreadCount } = await this.notifications.list(companyId, query);
    return paginated(items, pagination, 'Notifications retrieved.', { unreadCount });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the unread notification count' })
  async unreadCount(@CurrentCompanyId() companyId: string) {
    const unreadCount = await this.notifications.unreadCount(companyId);
    return respond({ unreadCount }, 'Unread count retrieved.');
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const notification = await this.notifications.markRead(companyId, id);
    return respond(notification, 'Notification marked as read.');
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentCompanyId() companyId: string) {
    const result = await this.notifications.markAllRead(companyId);
    return respond(result, 'All notifications marked as read.');
  }
}
