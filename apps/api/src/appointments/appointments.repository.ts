import { Injectable } from '@nestjs/common';
import type { Appointment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.AppointmentCreateInput): Promise<Appointment> {
    return this.prisma.appointment.create({ data });
  }

  findById(companyId: string, id: string): Promise<Appointment | null> {
    return this.prisma.appointment.findFirst({ where: { id, companyId, deletedAt: null } });
  }

  update(id: string, data: Prisma.AppointmentUpdateInput): Promise<Appointment> {
    return this.prisma.appointment.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Appointment> {
    return this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }

  async list(
    companyId: string,
    where: Prisma.AppointmentWhereInput,
    orderBy: Prisma.AppointmentOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<[Appointment[], number]> {
    const fullWhere: Prisma.AppointmentWhereInput = { companyId, deletedAt: null, ...where };
    return this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where: fullWhere,
        orderBy,
        skip,
        take,
        include: { customer: { select: { id: true, fullName: true, phone: true } } },
      }),
      this.prisma.appointment.count({ where: fullWhere }),
    ]);
  }
}
