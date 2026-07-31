import { LeadField, type ConversationState } from './types';

/** Beyond this, asking again costs more goodwill than the answer is worth. */
export const MAX_CLARIFICATION_ATTEMPTS = 2;

/**
 * Clarification manager.
 *
 * Owns the "say that again" loop, which is where automated phone systems most
 * visibly fail: they re-ask the identical question in the identical words until
 * the caller hangs up. Two rules prevent that — a hard attempt cap, and a
 * guarantee that no wording is ever reused for the same field.
 */
export class ClarificationManager {
  /** Should the receptionist re-ask, and is this the first or second try? */
  begin(state: ConversationState, topic: LeadField): { attempt: number; exhausted: boolean } {
    if (state.clarification.topic !== topic) {
      state.clarification = { topic, attempts: 1, usedPhrasings: [] };
      return { attempt: 1, exhausted: false };
    }

    const attempts = state.clarification.attempts + 1;
    state.clarification.attempts = attempts;
    return { attempt: attempts, exhausted: attempts > MAX_CLARIFICATION_ATTEMPTS };
  }

  /** Clear the loop once the value lands, or once we give up on it. */
  resolve(state: ConversationState): void {
    state.clarification = { topic: null, attempts: 0, usedPhrasings: [] };
  }

  /** Record the wording used, so the next attempt is guaranteed to differ. */
  recordPhrasing(state: ConversationState, phrasing: string): void {
    const normalized = phrasing.trim().toLowerCase();
    if (normalized && !state.clarification.usedPhrasings.includes(normalized)) {
      state.clarification.usedPhrasings.push(normalized);
    }
  }

  /**
   * True once the cap is spent and the field should simply be let go.
   *
   * Strictly greater than the cap, not equal to it: the second attempt is the
   * last one permitted, so it must still be planned. Treating attempt 2 as
   * exhausted would silently make the cap one.
   */
  isExhausted(state: ConversationState, topic: LeadField): boolean {
    return (
      state.clarification.topic === topic &&
      state.clarification.attempts > MAX_CLARIFICATION_ATTEMPTS
    );
  }

  /**
   * Confidence that the last caller turn was understood.
   *
   * There is no ASR confidence score on this transport, so it is inferred from
   * the shape of the transcript: empty or near-empty turns, and turns that are
   * mostly filler, are the observable signature of a caller who was not heard
   * properly.
   */
  static estimateConfidence(transcript: string): number {
    const text = transcript.trim();
    if (!text) return 0;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    if (words.length === 1) return /\b(yes|no|yeah|nope|sure|okay)\b/i.test(text) ? 0.9 : 0.45;

    // "[inaudible]"-style markers and heavy filler both indicate a poor capture.
    if (/\b(inaudible|unintelligible|crosstalk)\b/i.test(text)) return 0.2;

    const filler = words.filter((w) => /^(uh|um|er|hmm|uhh|mm)$/i.test(w)).length;
    const ratio = filler / words.length;
    if (ratio > 0.5) return 0.35;

    return ratio > 0.25 ? 0.65 : 0.9;
  }
}
