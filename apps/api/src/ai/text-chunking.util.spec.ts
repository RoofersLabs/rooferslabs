import { chunkText, estimateTokens } from './text-chunking.util';

describe('chunkText', () => {
  it('returns empty for blank content', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n  ')).toEqual([]);
  });

  it('returns a single chunk for short content', () => {
    expect(chunkText('We offer free estimates.')).toEqual(['We offer free estimates.']);
  });

  it('splits long content into chunks within the size limit', () => {
    const paragraph = 'Our roofing services are comprehensive and reliable. '.repeat(10).trim();
    const content = Array.from({ length: 6 }, () => paragraph).join('\n\n');
    const chunks = chunkText(content, 1000, 150);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1000 + 150 + 2); // chunk + overlap tail
      expect(chunk.trim()).toBe(chunk);
    }
  });

  it('hard-splits an oversized single paragraph on sentence boundaries', () => {
    const sentence = 'This is one full sentence about roof repairs and insurance claims. ';
    const monster = sentence.repeat(40).trim();
    const chunks = chunkText(monster, 500, 0);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('roof repairs');
  });
});

describe('estimateTokens', () => {
  it('estimates ~4 characters per token, rounding up', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});
