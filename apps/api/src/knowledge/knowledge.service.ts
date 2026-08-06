import { Injectable, Logger } from '@nestjs/common';
import type { KnowledgeArticle, Prisma } from '@prisma/client';
import { ApiErrorCode, KnowledgeStatus, type PaginationMeta } from '@rooferslabs/shared';
import { NotFoundError } from '../common/exceptions/domain.exception';
import {
  buildPaginationMeta,
  normalizePagination,
  parseSort,
} from '../common/utils/pagination.util';
import { OpenAiService } from '../ai/openai.service';
import { chunkText, estimateTokens } from '../ai/text-chunking.util';
import { KnowledgeRepository, type ChunkInput } from './knowledge.repository';
import type {
  CreateKnowledgeArticleDto,
  KnowledgeQueryDto,
  UpdateKnowledgeArticleDto,
} from './dto/knowledge.dto';

const SORTABLE = ['createdAt', 'updatedAt', 'title', 'category'] as const;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly openai: OpenAiService,
  ) {}

  async create(companyId: string, dto: CreateKnowledgeArticleDto): Promise<KnowledgeArticle> {
    const article = await this.repo.create({
      company: { connect: { id: companyId } },
      title: dto.title,
      content: dto.content,
      category: dto.category,
      keywords: dto.keywords ?? [],
      status: dto.status ?? KnowledgeStatus.PUBLISHED,
    });
    await this.indexArticle(companyId, article);
    return article;
  }

  async list(
    companyId: string,
    query: KnowledgeQueryDto,
  ): Promise<{ items: KnowledgeArticle[]; pagination: PaginationMeta }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const orderBy = parseSort(query.sort, SORTABLE, { field: 'updatedAt', direction: 'desc' });

    const where: Prisma.KnowledgeArticleWhereInput = {};
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { content: { contains: term, mode: 'insensitive' } },
        { keywords: { has: term.toLowerCase() } },
      ];
    }

    const [items, total] = await this.repo.list(companyId, where, orderBy, skip, take);
    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  async getById(companyId: string, id: string): Promise<KnowledgeArticle> {
    const article = await this.repo.findById(companyId, id);
    if (!article) {
      throw new NotFoundError(
        'Knowledge article not found.',
        ApiErrorCode.KNOWLEDGE_ARTICLE_NOT_FOUND,
      );
    }
    return article;
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateKnowledgeArticleDto,
  ): Promise<KnowledgeArticle> {
    const existing = await this.getById(companyId, id);
    const contentChanged = dto.content !== undefined && dto.content !== existing.content;

    const updated = await this.repo.update(id, {
      ...dto,
      ...(contentChanged ? { version: { increment: 1 } } : {}),
    });

    if (contentChanged) {
      await this.indexArticle(companyId, updated);
    }
    return updated;
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.getById(companyId, id);
    await this.repo.softDelete(id);
    await this.repo.replaceChunks(companyId, id, []);
  }

  /** Regenerate embeddings for every article (e.g. after adding an OpenAI key). */
  async reindexAll(companyId: string): Promise<{ reindexed: number }> {
    const { items } = await this.list(companyId, { page: 1, limit: 100 } as KnowledgeQueryDto);
    let count = 0;
    for (const article of items) {
      await this.indexArticle(companyId, article);
      count++;
    }
    return { reindexed: count };
  }

  /**
   * Chunk an article and (when OpenAI is configured) generate embeddings for
   * semantic retrieval. Indexing failures are logged but never block the write —
   * keyword retrieval remains available.
   */
  private async indexArticle(companyId: string, article: KnowledgeArticle): Promise<void> {
    try {
      const pieces = chunkText(article.content);
      if (pieces.length === 0) {
        await this.repo.replaceChunks(companyId, article.id, []);
        return;
      }

      let embeddings: number[][] = pieces.map(() => []);
      if (this.openai.isEnabled) {
        embeddings = await this.openai.embed(companyId, pieces);
      }

      const chunks: ChunkInput[] = pieces.map((content, i) => ({
        content,
        embedding: embeddings[i] ?? [],
        tokens: estimateTokens(content),
      }));
      await this.repo.replaceChunks(companyId, article.id, chunks);
    } catch (error) {
      this.logger.warn(
        `Failed to index article ${article.id} (retrieval falls back to keywords): ${(error as Error).message}`,
      );
    }
  }
}
