import { RagService } from './rag.service';

type Args = ConstructorParameters<typeof RagService>;

/**
 * The knowledge lookup is the only model call a caller waits through.
 *
 * `lookup_knowledge` runs mid-turn: the receptionist has stopped talking, the
 * line is silent, and nothing happens until the query has been embedded. These
 * cases are about not paying that cost twice for the same question.
 */
describe('query embedding cache', () => {
  function build(cached: number[] | null) {
    const redis = {
      get: jest.fn().mockResolvedValue(cached),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const openai = {
      isEnabled: true,
      embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    };
    const prisma = {
      knowledgeChunk: { findMany: jest.fn().mockResolvedValue([]) },
      knowledgeArticle: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const gate = {
      ensureActive: jest.fn().mockResolvedValue({ allowed: true, status: 'ACTIVE' }),
    };
    const rag = new RagService(
      prisma as unknown as Args[0],
      openai as unknown as Args[1],
      gate as unknown as Args[2],
      redis as unknown as Args[3],
    );
    return { rag, redis, openai };
  }

  it('embeds a query it has never seen, and remembers it', async () => {
    const { rag, redis, openai } = build(null);
    await rag.retrieve('co-1', 'do you install metal roofs');

    expect(openai.embed).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
    // Stored under a hash, not the caller's words.
    expect(redis.set.mock.calls[0]?.[0]).toMatch(/^rag:qvec:[0-9a-f]{64}$/);
  });

  it('skips the round trip entirely on a repeat question', async () => {
    // The win: the second caller asking the same thing waits for Redis, not for
    // OpenAI.
    const { rag, openai } = build([0.1, 0.2, 0.3]);
    await rag.retrieve('co-1', 'do you install metal roofs');
    expect(openai.embed).not.toHaveBeenCalled();
  });

  it('treats the question case-insensitively, so phrasing variants share a vector', async () => {
    const { rag, redis } = build(null);
    await rag.retrieve('co-1', 'Do You Install Metal Roofs');
    const upperKey = redis.set.mock.calls[0]?.[0] as string;

    const second = build(null);
    await second.rag.retrieve('co-1', 'do you install metal roofs');
    expect(second.redis.set.mock.calls[0]?.[0]).toBe(upperKey);
  });

  it('falls back to embedding when the cache is unavailable', async () => {
    // RedisService swallows its own failures and answers null, so the worst case
    // has to be the old behaviour rather than a failed lookup.
    const { rag, openai } = build(null);
    await rag.retrieve('co-1', 'how much is a new roof');
    expect(openai.embed).toHaveBeenCalled();
  });

  it('ignores a cached entry that is empty rather than trusting it', async () => {
    const { rag, openai } = build([]);
    await rag.retrieve('co-1', 'how much is a new roof');
    expect(openai.embed).toHaveBeenCalled();
  });

  it('never reaches the cache for a tenant that may not be served', async () => {
    // The tenant gate comes first: a paused tenant should not warm a cache, let
    // alone spend a token.
    const { rag, redis, openai } = build(null);
    const paused = new RagService(
      { knowledgeChunk: { findMany: jest.fn() } } as unknown as Args[0],
      openai as unknown as Args[1],
      { ensureActive: jest.fn().mockResolvedValue({ allowed: false, status: 'PAUSED' }) } as never,
      redis as unknown as Args[3],
    );
    await expect(paused.retrieve('co-1', 'metal roofs')).resolves.toEqual([]);
    expect(redis.get).not.toHaveBeenCalled();
    expect(openai.embed).not.toHaveBeenCalled();
    void rag;
  });
});
