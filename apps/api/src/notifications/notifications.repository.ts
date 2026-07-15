import { Injectable } from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  findById(companyId: string, id: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  async list(
    companyId: string,
    where: Prisma.NotificationWhereInput,
    skip: number,
    take: number,
  ): Promise<[Notification[], number]> {
    const fullWhere: Prisma.NotificationWhereInput = { companyId, deletedAt: null, ...where };
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: fullWhere,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: fullWhere }),
    ]);
  }

  countUnread(companyId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { companyId, deletedAt: null, status: 'UNREAD' },
    });
  }

  markRead(companyId: string, id: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { id, companyId, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  markAllRead(companyId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { companyId, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
  }
}
