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
