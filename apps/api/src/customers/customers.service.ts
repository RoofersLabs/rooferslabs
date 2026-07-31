import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  CustomerStatus,
  PropertyType,
  type PaginationMeta,
} from '@rooferslabs/shared';
import { NotFoundError } from '../common/exceptions/domain.exception';
import {
  buildPaginationMeta,
  normalizePagination,
  parseSort,
} from '../common/utils/pagination.util';
import { CustomersRepository } from './customers.repository';
import type { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';

const SORTABLE = ['createdAt', 'updatedAt', 'fullName', 'status'] as const;

export interface UpsertCustomerFromCallInput {
  phone?: string | null;
  fullName?: string | null;
  email?: string | null;
  propertyAddress?: string | null;
  propertyType?: PropertyType | null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async create(companyId: string, dto: CreateCustomerDto): Promise<Customer> {
    return this.repo.create({
      company: { connect: { id: companyId } },
      fullName: dto.fullName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      propertyAddress: dto.propertyAddress ?? null,
      propertyType: dto.propertyType ?? PropertyType.UNKNOWN,
      notes: dto.notes ?? null,
      status: CustomerStatus.ACTIVE,
    });
  }

  /**
   * The customer this number belongs to, if any. Used by the call pipeline to
   * recognise a returning caller from caller ID before the call is answered.
   * Returns null rather than throwing — an unrecognised number is the norm, not
   * an error, and must never delay answering the phone.
   */
  findByPhone(companyId: string, phone: string): Promise<Customer | null> {
    const trimmed = phone.trim();
    return trimmed ? this.repo.findByPhone(companyId, trimmed) : Promise.resolve(null);
  }

  async getById(companyId: string, id: string): Promise<Customer> {
    const customer = await this.repo.findById(companyId, id);
    if (!customer) {
      throw new NotFoundError('Customer not found.', ApiErrorCode.CUSTOMER_NOT_FOUND);
    }
    return customer;
  }

  /** The customer profile: the record plus their recent calls and appointments. */
  async getDetailById(companyId: string, id: string) {
    const customer = await this.repo.findDetailById(companyId, id);
    if (!customer) {
      throw new NotFoundError('Customer not found.', ApiErrorCode.CUSTOMER_NOT_FOUND);
    }
    return customer;
  }

  async list(
    companyId: string,
    query: CustomerQueryDto,
  ): Promise<{ items: Customer[]; pagination: PaginationMeta }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const orderBy = parseSort(query.sort, SORTABLE, { field: 'createdAt', direction: 'desc' });

    const where: Prisma.CustomerWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { propertyAddress: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.repo.list(companyId, where, orderBy, skip, take);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.getById(companyId, id);
    return this.repo.update(id, { ...dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.getById(companyId, id);
    await this.repo.softDelete(id);
  }

  /**
   * Match an existing customer by phone (within the tenant) or create a new one.
   * Used by the call pipeline to attach a caller to a customer record. Enriches
   * missing fields on an existing record without overwriting known values.
   */
  async upsertFromCall(
    companyId: string,
    input: UpsertCustomerFromCallInput,
  ): Promise<Customer | null> {
    const phone = input.phone?.trim();
    if (phone) {
      const existing = await this.repo.findByPhone(companyId, phone);
      if (existing) {
        const patch: Prisma.CustomerUpdateInput = {};
        if (!existing.fullName && input.fullName) patch.fullName = input.fullName;
        if (!existing.email && input.email) patch.email = input.email;
        if (!existing.propertyAddress && input.propertyAddress)
          patch.propertyAddress = input.propertyAddress;
        if (
          (!existing.propertyType || existing.propertyType === PropertyType.UNKNOWN) &&
          input.propertyType &&
          input.propertyType !== PropertyType.UNKNOWN
        ) {
          patch.propertyType = input.propertyType;
        }
        if (existing.status === CustomerStatus.NEW) patch.status = CustomerStatus.ACTIVE;
        return Object.keys(patch).length ? this.repo.update(existing.id, patch) : existing;
      }
    }

    if (!phone && !input.fullName && !input.email) {
      return null; // nothing identifiable to store
    }

    return this.repo.create({
      company: { connect: { id: companyId } },
      fullName: input.fullName ?? null,
      phone: phone ?? null,
      email: input.email ?? null,
      propertyAddress: input.propertyAddress ?? null,
      propertyType: input.propertyType ?? PropertyType.UNKNOWN,
      status: CustomerStatus.NEW,
    });
  }
}
