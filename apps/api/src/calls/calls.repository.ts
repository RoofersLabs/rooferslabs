import { Injectable } from '@nestjs/common';
import type { Call, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const callListInclude = {
  customer: { select: { id: true, fullName: true, phone: true } },
  conversation: {
    select: {
      id: true,
      outcome: true,
      intent: true,
      leadQuality: true,
      urgency: true,
      isEmergency: true,
      summary: true,
    },
  },
} satisfies Prisma.CallInclude;

@Injectable()
export class CallsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CallCreateInput): Promise<Call> {
    return this.prisma.call.create({ data });
  }

  findById(companyId: string, id: string) {
    return this.prisma.call.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        conversation: true,
        phoneNumber: { select: { id: true, phoneNumber: true } },
      },
    });
  }

  findByTwilioSid(twilioCallSid: string): Promise<Call | null> {
    return this.prisma.call.findUnique({ where: { twilioCallSid } });
  }

  /**
   * The most recent inbound call for a company since a given time, preferring
   * one that carries forwarding evidence (Twilio's ForwardedFrom). Used to
   * verify that the customer's carrier forwarding actually works.
   */
  async findForwardingEvidence(companyId: string, since: Date): Promise<Call | null> {
    const forwarded = await this.prisma.call.findFirst({
      where: { companyId, direction: 'INBOUND', forwardedFrom: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (forwarded) return forwarded;
    return this.prisma.call.findFirst({
      where: { companyId, direction: 'INBOUND', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.CallUpdateInput): Promise<Call> {
    return this.prisma.call.update({ where: { id }, data });
  }

  async list(
    companyId: string,
    where: Prisma.CallWhereInput,
    orderBy: Prisma.CallOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    const fullWhere: Prisma.CallWhereInput = { companyId, ...where };
    return this.prisma.$transaction([
      this.prisma.call.findMany({
        where: fullWhere,
        orderBy,
        skip,
        take,
        include: callListInclude,
      }),
      this.prisma.call.count({ where: fullWhere }),
    ]);
  }
}
