import { Injectable } from '@nestjs/common';
import type { Prisma, PhoneNumber } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhoneNumbersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByNumber(phoneNumber: string): Promise<PhoneNumber | null> {
    return this.prisma.phoneNumber.findUnique({ where: { phoneNumber } });
  }

  findActiveForCompany(companyId: string): Promise<PhoneNumber | null> {
    return this.prisma.phoneNumber.findFirst({
      where: { companyId, status: { in: ['ASSIGNED', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Prisma.PhoneNumberCreateInput): Promise<PhoneNumber> {
    return this.prisma.phoneNumber.create({ data });
  }

  update(id: string, data: Prisma.PhoneNumberUpdateInput): Promise<PhoneNumber> {
    return this.prisma.phoneNumber.update({ where: { id }, data });
  }
}
