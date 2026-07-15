import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { paginated, respond } from '../common/response';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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
