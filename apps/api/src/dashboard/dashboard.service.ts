import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read model aggregating today's operational snapshot for the dashboard
 * (docs/04_Frontend_Architecture §22). All queries are tenant-scoped.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const dayStart = startOfTodayInTimeZone(company?.timezone ?? 'America/New_York');
    const weekStart = new Date(dayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [
      todaysCalls,
      todaysConversations,
      todaysEmergencies,
      weeklyCalls,
      pendingAppointments,
      totalCustomers,
      unreadNotifications,
      recentConversations,
      upcomingAppointments,
    ] = await this.prisma.$transaction([
      this.prisma.call.count({ where: { companyId, createdAt: { gte: dayStart } } }),
      this.prisma.conversation.count({
        where: {
          companyId,
          createdAt: { gte: dayStart },
          outcome: { in: ['LEAD_CAPTURED', 'APPOINTMENT_REQUESTED', 'EMERGENCY'] },
        },
      }),
      this.prisma.conversation.count({
        where: { companyId, isEmergency: true, createdAt: { gte: dayStart } },
      }),
      this.prisma.call.count({ where: { companyId, createdAt: { gte: weekStart } } }),
      this.prisma.appointment.count({
        where: { companyId, deletedAt: null, status: 'REQUESTED' },
      }),
      this.prisma.customer.count({ where: { companyId, deletedAt: null } }),
      this.prisma.notification.count({
        where: { companyId, deletedAt: null, status: 'UNREAD' },
      }),
      this.prisma.conversation.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          call: { select: { durationSeconds: true, fromNumber: true } },
        },
      }),
      this.prisma.appointment.findMany({
        where: { companyId, deletedAt: null, status: { in: ['REQUESTED', 'CONFIRMED'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
      }),
    ]);

    return {
      metrics: {
        todaysCalls,
        todaysLeads: todaysConversations,
        todaysEmergencies,
        weeklyCalls,
        pendingAppointments,
        totalCustomers,
        unreadNotifications,
      },
      recentConversations,
      upcomingAppointments,
    };
  }
}

/** UTC instant corresponding to local midnight today in the given IANA zone. */
function startOfTodayInTimeZone(timeZone: string): Date {
  const now = new Date();
  try {
    const offsetMs = tzOffsetMs(now, timeZone);
    const local = new Date(now.getTime() + offsetMs);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - offsetMs);
  } catch {
    const fallback = new Date(now);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone }));
  return local.getTime() - utc.getTime();
}
