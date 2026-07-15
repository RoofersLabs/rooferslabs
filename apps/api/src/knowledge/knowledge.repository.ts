import { Injectable } from '@nestjs/common';
import type { KnowledgeArticle, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ChunkInput {
  content: string;
  embedding: number[];
  tokens: number;
}

/** Data-access for knowledge articles and their embedding chunks. */
@Injectable()
export class KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.KnowledgeArticleCreateInput): Promise<KnowledgeArticle> {
    return this.prisma.knowledgeArticle.create({ data });
  }

  findById(companyId: string, id: string): Promise<KnowledgeArticle | null> {
    return this.prisma.knowledgeArticle.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async list(
    companyId: string,
    where: Prisma.KnowledgeArticleWhereInput,
    orderBy: Prisma.KnowledgeArticleOrderByWithRelationInput,
    skip: number,
    take: number,
  ): Promise<[KnowledgeArticle[], number]> {
    const fullWhere: Prisma.KnowledgeArticleWhereInput = { companyId, deletedAt: null, ...where };
    return this.prisma.$transaction([
      this.prisma.knowledgeArticle.findMany({ where: fullWhere, orderBy, skip, take }),
      this.prisma.knowledgeArticle.count({ where: fullWhere }),
    ]);
  }

  update(id: string, data: Prisma.KnowledgeArticleUpdateInput): Promise<KnowledgeArticle> {
    return this.prisma.knowledgeArticle.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<KnowledgeArticle> {
    return this.prisma.knowledgeArticle.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  /** Replace an article's chunks atomically (used after (re)indexing). */
  async replaceChunks(companyId: string, articleId: string, chunks: ChunkInput[]): Promise<void> {
    await this.prisma.runInTransaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({ where: { articleId } });
      if (chunks.length) {
        await tx.knowledgeChunk.createMany({
          data: chunks.map((chunk) => ({
            companyId,
            articleId,
            content: chunk.content,
            embedding: chunk.embedding,
            tokens: chunk.tokens,
          })),
        });
      }
    });
  }
}
