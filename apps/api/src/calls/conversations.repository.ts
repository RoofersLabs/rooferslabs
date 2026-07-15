import { Injectable } from '@nestjs/common';
import type { Conversation, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const conversationListInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  call: { select: { id: true, durationSeconds: true, fromNumber: true, createdAt: true } },
} satisfies Prisma.ConversationInclude;

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(companyId: string, id: string) {
    return this.prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        call: true,
        appointment: true,
      },
    });
  }

  async list(
    companyId: string,
    where: Prisma.ConversationWhereInput,
    orderBy: Prisma.ConversationOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    const fullWhere: Prisma.ConversationWhereInput = { companyId, ...where };
    return this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: fullWhere,
        orderBy,
        skip,
        take,
        include: conversationListInclude,
      }),
      this.prisma.conversation.count({ where: fullWhere }),
    ]);
  }

  recent(companyId: string, take: number): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
      include: conversationListInclude,
    });
  }
}
