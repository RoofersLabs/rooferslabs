import { Injectable } from '@nestjs/common';
import type { Appointment, Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  AppointmentPriority,
  AppointmentStatus,
  type PaginationMeta,
} from '@rooferslabs/shared';
import { NotFoundError } from '../common/exceptions/domain.exception';
import {
  buildPaginationMeta,
  normalizePagination,
  parseSort,
} from '../common/utils/pagination.util';
import { AppointmentsRepository } from './appointments.repository';
import type {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
} from './dto/appointment.dto';

const SORTABLE = ['createdAt', 'preferredDate', 'priority', 'status'] as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly repo: AppointmentsRepository) {}

  async create(companyId: string, dto: CreateAppointmentDto): Promise<Appointment> {
    return this.repo.create({
      company: { connect: { id: companyId } },
      ...(dto.customerId ? { customer: { connect: { id: dto.customerId } } } : {}),
      serviceRequested: dto.serviceRequested ?? null,
      propertyAddress: dto.propertyAddress ?? null,
      preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
      preferredTimeWindow: dto.preferredTimeWindow ?? null,
      priority: dto.priority ?? AppointmentPriority.NORMAL,
      notes: dto.notes ?? null,
      status: AppointmentStatus.REQUESTED,
    });
  }

  async getById(companyId: string, id: string): Promise<Appointment> {
    const appointment = await this.repo.findById(companyId, id);
    if (!appointment) {
      throw new NotFoundError('Appointment not found.', ApiErrorCode.APPOINTMENT_NOT_FOUND);
    }
    return appointment;
  }

  async list(
    companyId: string,
    query: AppointmentQueryDto,
  ): Promise<{ items: Appointment[]; pagination: PaginationMeta }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const orderBy = parseSort(query.sort, SORTABLE, { field: 'createdAt', direction: 'desc' });

    const where: Prisma.AppointmentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const [items, total] = await this.repo.list(companyId, where, orderBy, skip, take);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async update(companyId: string, id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    await this.getById(companyId, id);
    const data: Prisma.AppointmentUpdateInput = {
      serviceRequested: dto.serviceRequested,
      propertyAddress: dto.propertyAddress,
      preferredTimeWindow: dto.preferredTimeWindow,
      priority: dto.priority,
      notes: dto.notes,
      status: dto.status,
    };
    if (dto.preferredDate !== undefined) {
      data.preferredDate = dto.preferredDate ? new Date(dto.preferredDate) : null;
    }
    return this.repo.update(id, data);
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.getById(companyId, id);
    await this.repo.softDelete(id);
  }
}
