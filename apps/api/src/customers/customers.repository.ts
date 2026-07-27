import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  findById(companyId: string, id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  /**
   * The customer plus the records their profile page is built from.
   *
   * One query rather than three round trips: the profile always shows all of
   * it, and a phone on a job site should not pay for three requests to render
   * one screen. Both relations are capped — a profile shows recent history, and
   * anything longer belongs on the Calls and Appointments pages.
   */
  findDetailById(companyId: string, id: string) {
    return this.prisma.customer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { call: { select: { durationSeconds: true, createdAt: true } } },
        },
        appointments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  findByPhone(companyId: string, phone: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { companyId, phone, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async list(
    companyId: string,
    where: Prisma.CustomerWhereInput,
    orderBy: Prisma.CustomerOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<[Customer[], number]> {
    const fullWhere: Prisma.CustomerWhereInput = { companyId, deletedAt: null, ...where };
    return this.prisma.$transaction([
      this.prisma.customer.findMany({ where: fullWhere, orderBy, skip, take }),
      this.prisma.customer.count({ where: fullWhere }),
    ]);
  }

  countByCompany(companyId: string): Promise<number> {
    return this.prisma.customer.count({ where: { companyId, deletedAt: null } });
  }
}
