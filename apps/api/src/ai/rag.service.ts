import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeStatus, type RetrievedKnowledge } from '@rooferslabs/shared';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AccountStatusService } from '../tenant-status/account-status.service';
import { OpenAiService } from './openai.service';

/**
 * How long a query's embedding is reused.
 *
 * The vector for a phrase never changes — only the embedding model could change
 * it — so this could be far longer. A day is chosen because it is long enough
 * that a company's common questions stay warm through a working week of calls,
 * and short enough that swapping the embedding model does not require anyone to
 * remember to flush a cache.
 */
const QUERY_EMBEDDING_TTL_SECONDS = 86_400;

/**
 * Retrieval-Augmented Generation over a company's knowledge base. Uses semantic
 * search (embedding cosine similarity) when OpenAI is configured, and falls back
 * to keyword matching otherwise. Retrieval is always tenant-scoped: the AI can
 * never read another company's knowledge.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly accountStatus: AccountStatusService,
    private readonly redis: RedisService,
  ) {}

  async retrieve(companyId: string, query: string, limit = 5): Promise<RetrievedKnowledge[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Gated here as well as inside the OpenAI adapter, because the keyword
    // fallback below never touches OpenAI: without this, a paused tenant's
    // knowledge base would still be searchable and its articles still quotable
    // by anything that reached this method.
    const gate = await this.accountStatus.ensureActive(
      companyId,
      'knowledge.retrieval',
      'retrieve',
    );
    if (!gate.allowed) return [];

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

  /**
   * The query's embedding, from cache when possible.
   *
   * This is the one piece of the pipeline that makes a caller wait *during* a
   * sentence. The receptionist calls `lookup_knowledge` mid-turn, and until the
   * embedding comes back the line is silent — so a round trip to OpenAI here is
   * heard, unlike the same call in the post-call pipeline where nobody is
   * listening.
   *
   * Callers ask the same handful of things ("do you do metal roofs", "how much
   * is a new roof"), so after the first call of a given phrasing this collapses
   * to a Redis GET. A cache miss costs exactly what it cost before, and a Redis
   * failure degrades to the same thing: `RedisService` swallows its own errors,
   * so the worst case is the old behaviour rather than a failed lookup.
   *
   * Keyed by a hash of the text, not the text: queries are caller speech and can
   * be long, and a hash keeps the keyspace bounded and free of anything
   * resembling personal data. It is not tenant-scoped because an embedding is a
   * property of the words alone — the retrieval it feeds is still scoped to the
   * company, which is where tenant isolation actually lives.
   */
  private async embedQuery(companyId: string, query: string): Promise<number[] | null> {
    const key = `rag:qvec:${createHash('sha256').update(query.toLowerCase()).digest('hex')}`;

    const cached = await this.redis.get<number[]>(key);
    if (cached && cached.length > 0) return cached;

    const [embedding] = await this.openai.embed(companyId, [query]);
    if (!embedding || embedding.length === 0) return null;

    void this.redis.set(key, embedding, QUERY_EMBEDDING_TTL_SECONDS);
    return embedding;
  }

  private async semanticRetrieve(
    companyId: string,
    query: string,
    limit: number,
  ): Promise<RetrievedKnowledge[]> {
    const queryEmbedding = await this.embedQuery(companyId, query);
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
