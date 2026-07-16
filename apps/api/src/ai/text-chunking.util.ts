/**
 * Split article content into overlapping chunks suitable for embedding. Chunks
 * respect paragraph and sentence boundaries where possible to preserve meaning.
 */
export function chunkText(content: string, maxChars = 1000, overlap = 150): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= maxChars) {
    return normalized.length > 0 ? [normalized] : [];
  }

  // Prefer splitting on paragraph boundaries, then pack into chunks.
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      push();
      current = '';
      // Long paragraph: hard-split by sentences.
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let buffer = '';
      for (const sentence of sentences) {
        if ((buffer + ' ' + sentence).trim().length > maxChars) {
          if (buffer.trim()) chunks.push(buffer.trim());
          buffer = sentence;
        } else {
          buffer = `${buffer} ${sentence}`.trim();
        }
      }
      if (buffer.trim()) chunks.push(buffer.trim());
      continue;
    }

    if ((current + '\n\n' + paragraph).trim().length > maxChars) {
      push();
      // Start a new chunk with a small overlap tail from the previous one.
      current = overlap > 0 ? `${current.slice(-overlap)}\n\n${paragraph}`.trim() : paragraph;
    } else {
      current = `${current}\n\n${paragraph}`.trim();
    }
  }
  push();

  return chunks;
}

/** Rough token estimate (~4 chars/token) for storing chunk sizing metadata. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
