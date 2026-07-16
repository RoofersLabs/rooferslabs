import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeStatus, type RetrievedKnowledge } from '@rooferslabs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';

/**
 * Retrieval-Augmented Generation over a company's knowledge base. Uses semantic
 * search (embedding cosine similarity) when OpenAI is configured, and falls back
 * to keyword matching otherwise. Retrieval is always tenant-scoped: the AI can
 * never read another company's knowledge (docs/00_GStack §Non-Negotiable Rules).
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async retrieve(companyId: string, query: string, limit = 5): Promise<RetrievedKnowledge[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (this.openai.isEnabled) {
      try {
        return await this.semanticRetrieve(companyId, trimmed, limit);
      } catch (error) {
        this.logger.warn(
          `Semantic retrieval failed, falling back to keyword search: ${(error as Error).message}`,
        );
      }
    }
    return this.keywordRetrieve(companyId, trimmed, limit);
  }

  private async semanticRetrieve(
    companyId: string,
    query: string,
    limit: number,
  ): Promise<RetrievedKnowledge[]> {
    const [queryEmbedding] = await this.openai.embed([query]);
    if (!queryEmbedding) return this.keywordRetrieve(companyId, query, limit);

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        companyId,
        embedding: { isEmpty: false },
        article: { status: KnowledgeStatus.PUBLISHED, deletedAt: null },
      },
      include: { article: { select: { id: true, title: true, category: true } } },
      take: 500,
    });

    if (chunks.length === 0) return this.keywordRetrieve(companyId, query, limit);

    const scored = chunks
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ chunk, score }) => ({
      articleId: chunk.article.id,
      title: chunk.article.title,
      category: chunk.article.category,
      content: chunk.content,
      score,
    }));
  }

  private async keywordRetrieve(
    companyId: string,
    query: string,
    limit: number,
  ): Promise<RetrievedKnowledge[]> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .slice(0, 8);

    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        companyId,
        status: KnowledgeStatus.PUBLISHED,
        deletedAt: null,
        ...(terms.length
          ? {
              OR: [
                ...terms.map((term) => ({
                  content: { contains: term, mode: 'insensitive' as const },
                })),
                ...terms.map((term) => ({
                  title: { contains: term, mode: 'insensitive' as const },
                })),
                { keywords: { hasSome: terms } },
              ],
            }
          : {}),
      },
      take: limit,
    });

    return articles.map((article) => {
      const haystack =
        `${article.title} ${article.content} ${article.keywords.join(' ')}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term)).length;
      return {
        articleId: article.id,
        title: article.title,
        category: article.category,
        content: article.content,
        score: terms.length ? matches / terms.length : 0.5,
      };
    });
  }
}

/** Cosine similarity between two equal-length vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
