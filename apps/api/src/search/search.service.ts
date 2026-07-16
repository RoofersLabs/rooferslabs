import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cross-entity global search over customers, conversations, and appointments.
 * Every query is tenant-scoped and case-insensitive (docs/09_API_Standards §22).
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(companyId: string, rawQuery: string) {
    const query = rawQuery.trim();
    if (query.length < 2) {
      return { customers: [], conversations: [], appointments: [], knowledgeArticles: [] };
    }
    const contains = { contains: query, mode: 'insensitive' as const };

    const [customers, conversations, appointments, knowledgeArticles] =
      await this.prisma.$transaction([
        this.prisma.customer.findMany({
          where: {
            companyId,
            deletedAt: null,
            OR: [
              { fullName: contains },
              { phone: contains },
              { email: contains },
              { propertyAddress: contains },
            ],
          },
          take: 8,
          select: { id: true, fullName: true, phone: true, email: true, status: true },
        }),
        this.prisma.conversation.findMany({
          where: {
            companyId,
            OR: [{ summary: contains }, { customer: { fullName: contains } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            summary: true,
            outcome: true,
            isEmergency: true,
            createdAt: true,
            customer: { select: { fullName: true } },
          },
        }),
        this.prisma.appointment.findMany({
          where: {
            companyId,
            deletedAt: null,
            OR: [{ serviceRequested: contains }, { propertyAddress: contains }],
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            serviceRequested: true,
            status: true,
            priority: true,
            preferredDate: true,
          },
        }),
        this.prisma.knowledgeArticle.findMany({
          where: {
            companyId,
            deletedAt: null,
            OR: [{ title: contains }, { content: contains }],
          },
          take: 6,
          select: { id: true, title: true, category: true },
        }),
      ]);

    return { customers, conversations, appointments, knowledgeArticles };
  }
}
