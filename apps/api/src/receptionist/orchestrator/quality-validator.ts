import { LeadCompletenessTracker } from './lead-completeness';
import {
  EmpathyLevel,
  LeadField,
  type ConversationState,
  type QualityFinding,
  type TurnPlan,
} from './types';

/** Above this, a spoken turn stops being conversation and becomes a monologue. */
const MAX_WORDS_PER_TURN = 60;

/** Jaccard similarity above this counts as saying the same thing again. */
const REPETITION_THRESHOLD = 0.6;

/** Phrases that break the illusion the caller reached an office. */
const DISCLOSURE_PATTERNS = [
  /\bas an ai\b/i,
  /\bi'?m an ai\b/i,
  /\blanguage model\b/i,
  /\bvirtual assistant\b/i,
  /\bi'?m a bot\b/i,
  /\bmy (instructions|prompt|training)\b/i,
];

/** Words that signal the receptionist asked for something already known. */
const FIELD_PROBES: Partial<Record<LeadField, RegExp>> = {
  [LeadField.NAME]: /\b(your name|who am i speaking|who i'?m speaking|may i (have|ask))\b/i,
  [LeadField.PHONE]: /\b(phone number|callback number|best number|number to reach)\b/i,
  [LeadField.ADDRESS]: /\b(address|where is the (property|house)|street)\b/i,
  [LeadField.PROPERTY_TYPE]: /\b(house or (a )?(business|commercial)|residential or commercial)\b/i,
};

/**
 * Quality validator.
 *
 * Runs against each assistant turn after it has been spoken. On this transport
 * that is the only option — the model streams audio directly to the caller, so
 * there is no point at which a turn could be inspected and withheld. What the
 * findings do instead is feed the next turn's guidance, which is why the
 * orchestrator surfaces them as corrections rather than as logs.
 *
 * The distinction matters and is deliberate: this is a feedback loop, not a gate.
 */
export class QualityValidator {
  constructor(private readonly completeness = new LeadCompletenessTracker()) {}

  /** Inspect one assistant turn against the plan it was supposed to satisfy. */
  validate(text: string, plan: TurnPlan, state: ConversationState): QualityFinding[] {
    const findings: QualityFinding[] = [];
    const trimmed = text.trim();
    if (!trimmed) return findings;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > MAX_WORDS_PER_TURN) {
      findings.push({
        code: 'TOO_VERBOSE',
        detail: `${words.length} words in one turn; keep turns to about ${MAX_WORDS_PER_TURN}.`,
      });
    }

    const questionCount = (trimmed.match(/\?/g) ?? []).length;
    if (questionCount > 1) {
      findings.push({
        code: 'MULTIPLE_QUESTIONS',
        detail: `${questionCount} questions in one turn; ask one at a time.`,
      });
    }

    if (DISCLOSURE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      findings.push({
        code: 'AI_DISCLOSURE',
        detail: 'The turn referred to being an AI. The caller reached an office.',
      });
    }

    const repeated = this.findRepetition(trimmed, state.recentAssistantTurns);
    if (repeated) {
      findings.push({
        code: 'REPETITIVE',
        detail: `Nearly identical to an earlier turn: "${repeated}".`,
      });
    }

    for (const [field, probe] of Object.entries(FIELD_PROBES) as [LeadField, RegExp][]) {
      if (this.completeness.has(state, field) && probe.test(trimmed)) {
        findings.push({
          // Deliberately "already known" rather than "the caller already gave":
          // the phone number is seeded from caller ID, so telling the model the
          // caller stated it would be a plain untruth it might repeat aloud.
          code: 'ASKED_KNOWN_FIELD',
          detail: `Asked for ${field.toLowerCase()}, which is already known.`,
        });
      }
    }

    if (
      (plan.empathy === EmpathyLevel.REASSURE || plan.empathy === EmpathyLevel.DE_ESCALATE) &&
      questionCount > 0 &&
      words.length < 8
    ) {
      // A bare question to someone who is panicking or angry reads as cold.
      findings.push({
        code: 'MISSING_EMPATHY',
        detail: 'A bare question was asked where the plan called for reassurance first.',
      });
    }

    if (questionCount === 0 && plan.targetField && !this.advancesToward(trimmed, plan)) {
      findings.push({
        code: 'NO_FORWARD_MOTION',
        detail: `The turn neither asked for ${plan.targetField.toLowerCase()} nor moved the call on.`,
      });
    }

    return findings;
  }

  /** Corrections to hand the model on the next turn, phrased as instructions. */
  corrections(findings: QualityFinding[]): string[] {
    return findings.map((finding) => {
      switch (finding.code) {
        case 'TOO_VERBOSE':
          return 'Your last turn was too long. Cut it down — one or two sentences.';
        case 'REPETITIVE':
          return 'You just repeated yourself. Say it a different way this time.';
        case 'ASKED_KNOWN_FIELD':
          return `You asked for something that is already on the record. ${finding.detail} Do not ask again.`;
        case 'MULTIPLE_QUESTIONS':
          return 'You asked more than one question at once. One at a time.';
        case 'AI_DISCLOSURE':
          return 'Never refer to being an AI. You are the receptionist at the office.';
        case 'MISSING_EMPATHY':
          return 'Acknowledge how they are feeling before you ask anything else.';
        case 'NO_FORWARD_MOTION':
          return 'That turn did not move the call forward. Advance it now.';
      }
    });
  }

  private advancesToward(text: string, plan: TurnPlan): boolean {
    const probe = plan.targetField ? FIELD_PROBES[plan.targetField] : undefined;
    if (probe?.test(text)) return true;
    // A statement that ends in a prompt to speak still counts as motion.
    return /\b(let me|i'?ll|we'?ll|go ahead|tell me)\b/i.test(text);
  }

  /** The most similar earlier turn, when similarity crosses the threshold. */
  private findRepetition(text: string, previous: string[]): string | null {
    const current = tokenize(text);
    if (current.size < 4) return null;

    for (const earlier of previous) {
      const other = tokenize(earlier);
      if (other.size < 4) continue;

      let shared = 0;
      for (const token of current) if (other.has(token)) shared += 1;
      const union = current.size + other.size - shared;
      if (union > 0 && shared / union >= REPETITION_THRESHOLD) return earlier;
    }
    return null;
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}
