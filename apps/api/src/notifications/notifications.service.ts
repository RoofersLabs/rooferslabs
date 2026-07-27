import { Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  type PaginationMeta,
} from '@rooferslabs/shared';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { buildPaginationMeta, normalizePagination } from '../common/utils/pagination.util';
import { NotificationsRepository } from './notifications.repository';
import { PushService } from './push.service';
import type { NotificationQueryDto } from './dto/notification.dto';

export interface CreateNotificationInput {
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  relatedEntity?: { type: string; id: string };
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly push: PushService,
  ) {}

  /**
   * Emit a notification. Called by the call pipeline and other domains.
   * Also fans out to the company's Web Push subscriptions (best-effort).
   */
  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = await this.repo.create({
      company: { connect: { id: input.companyId } },
      type: input.type,
      title: input.title,
      message: input.message,
      priority: input.priority ?? NotificationPriority.NORMAL,
      channel: input.channel ?? NotificationChannel.IN_APP,
      relatedEntity: (input.relatedEntity ?? undefined) as Prisma.InputJsonValue | undefined,
    });

    void this.push.sendToCompany(input.companyId, {
      title: input.title,
      message: input.message,
      priority: notification.priority,
      url:
        input.relatedEntity?.type === 'conversation'
          ? `/conversations/${input.relatedEntity.id}`
          : '/notifications',
    });

    return notification;
  }

  async list(
    companyId: string,
    query: NotificationQueryDto,
  ): Promise<{ items: Notification[]; pagination: PaginationMeta; unreadCount: number }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const where: Prisma.NotificationWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    const [[items, total], unreadCount] = await Promise.all([
      this.repo.list(companyId, where, skip, take),
      this.repo.countUnread(companyId),
    ]);
    return { items, pagination: buildPaginationMeta(page, limit, total), unreadCount };
  }

  unreadCount(companyId: string): Promise<number> {
    return this.repo.countUnread(companyId);
  }

  async markRead(companyId: string, id: string): Promise<Notification> {
    const notification = await this.repo.findById(companyId, id);
    if (!notification) throw new NotFoundError('Notification not found.');
    await this.repo.markRead(companyId, id);
    const updated = await this.repo.findById(companyId, id);
    return updated ?? notification;
  }

  async markUnread(companyId: string, id: string): Promise<Notification> {
    const notification = await this.repo.findById(companyId, id);
    if (!notification) throw new NotFoundError('Notification not found.');
    await this.repo.markUnread(companyId, id);
    const updated = await this.repo.findById(companyId, id);
    return updated ?? notification;
  }

  async markAllRead(companyId: string): Promise<{ updated: number }> {
    const result = await this.repo.markAllRead(companyId);
    return { updated: result.count };
  }
}
