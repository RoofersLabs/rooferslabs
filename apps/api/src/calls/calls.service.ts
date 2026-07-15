import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApiErrorCode, type PaginationMeta } from '@rooferslabs/shared';
import { NotFoundError } from '../common/exceptions/domain.exception';
import {
  buildPaginationMeta,
  normalizePagination,
  parseSort,
} from '../common/utils/pagination.util';
import { CallsRepository } from './calls.repository';
import { ConversationsRepository } from './conversations.repository';
import type { CallQueryDto, ConversationQueryDto } from './dto/calls.dto';

const CALL_SORTABLE = ['createdAt', 'durationSeconds', 'status'] as const;
const CONVO_SORTABLE = ['createdAt', 'outcome', 'urgency'] as const;

@Injectable()
export class CallsService {
  constructor(
    private readonly calls: CallsRepository,
    private readonly conversations: ConversationsRepository,
  ) {}

  async listCalls(
    companyId: string,
    query: CallQueryDto,
  ): Promise<{ items: unknown[]; pagination: PaginationMeta }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const orderBy = parseSort(query.sort, CALL_SORTABLE, { field: 'createdAt', direction: 'desc' });

    const where: Prisma.CallWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { fromNumber: { contains: term, mode: 'insensitive' } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.calls.list(companyId, where, orderBy, skip, take);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async getCall(companyId: string, id: string) {
    const call = await this.calls.findById(companyId, id);
    if (!call) throw new NotFoundError('Call not found.');
    return call;
  }

  async listConversations(
    companyId: string,
    query: ConversationQueryDto,
  ): Promise<{ items: unknown[]; pagination: PaginationMeta }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const orderBy = parseSort(query.sort, CONVO_SORTABLE, {
      field: 'createdAt',
      direction: 'desc',
    });

    const where: Prisma.ConversationWhereInput = {};
    if (query.outcome) where.outcome = query.outcome;
    if (query.emergency) where.isEmergency = true;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { summary: { contains: term, mode: 'insensitive' } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.conversations.list(companyId, where, orderBy, skip, take);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async getConversation(companyId: string, id: string) {
    const conversation = await this.conversations.findById(companyId, id);
    if (!conversation) {
      throw new NotFoundError('Conversation not found.', ApiErrorCode.CONVERSATION_NOT_FOUND);
    }
    return conversation;
  }
}
