import { MAX_CLARIFICATION_ATTEMPTS } from './clarification';
import { Sentiment, type ConversationState } from './types';

/** Repeated failure to understand is the point at which a person does better. */
const FAILED_TURN_THRESHOLD = 3;

/**
 * Human escalation logic.
 *
 * Escalation is treated as a save, not a failure: the caller who is handed to a
 * person while still willing to talk is retained, and the one who is handed over
 * after four rounds of "sorry, say that again" has usually already decided about
 * the company. So the triggers are early and generous.
 */
export class EscalationPolicy {
  /**
   * Evaluate whether a human should take over, given the state after the latest
   * caller turn. Mutates the escalation slice of state and returns it.
   */
  evaluate(state: ConversationState, transferAvailable: boolean): ConversationState['escalation'] {
    if (state.escalation.requestedByCaller) {
      state.escalation.recommended = true;
      state.escalation.reason ??= 'The caller asked for a person.';
      return state.escalation;
    }

    if (!transferAvailable) {
      // Nothing to escalate to. The receptionist should still change register
      // and promise a callback rather than keep pushing — the planner does that
      // off `sentiment`, so nothing is recommended here.
      return state.escalation;
    }

    if (state.sentiment === Sentiment.ANGER) {
      state.escalation.recommended = true;
      state.escalation.reason = 'The caller is angry; a person will do better than a script.';
      return state.escalation;
    }

    if (state.clarification.attempts > MAX_CLARIFICATION_ATTEMPTS) {
      state.escalation.recommended = true;
      state.escalation.reason = 'Repeated failure to capture the same detail.';
      return state.escalation;
    }

    const lowConfidenceTurns = state.sentimentHistory.length >= FAILED_TURN_THRESHOLD;
    if (lowConfidenceTurns && state.confidence < 0.4) {
      state.escalation.recommended = true;
      state.escalation.reason = 'The line or the audio is too poor to continue reliably.';
    }

    return state.escalation;
  }

  /** The caller said, in some form, "let me talk to a human". */
  static detectRequest(transcript: string): boolean {
    return /\b(speak|talk) (to|with) (a |an )?(real )?(person|human|someone|manager|supervisor|rep)\b/i.test(
      transcript,
    );
  }
}
