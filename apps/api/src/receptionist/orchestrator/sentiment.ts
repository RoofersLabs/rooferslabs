import { Sentiment } from './types';

/**
 * Sentiment analyzer.
 *
 * Deliberately lexical rather than a model call: it runs on every caller turn
 * inside a live phone call, where a round trip would cost more latency than the
 * signal is worth. It exists to pick a register — calm someone down, slow down,
 * stop selling — not to score a customer, so a coarse read that is instant beats
 * a precise one that arrives after the reply has already been spoken.
 *
 * Ordering matters: the checks run most-severe first, because a caller who is
 * both panicking and frustrated needs the panic handled.
 */

interface Rule {
  sentiment: Sentiment;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  {
    sentiment: Sentiment.PANIC,
    patterns: [
      /\b(pouring|flooding|gushing|collapsed|caving in|coming down)\b/,
      /\bwater (is )?(everywhere|all over|coming (in|through|down))\b/,
      /\b(help me|oh my god|i don'?t know what to do)\b/,
      /\b(ceiling|roof) (is )?(falling|collapsing)\b/,
    ],
  },
  {
    sentiment: Sentiment.ANGER,
    patterns: [
      /\b(ridiculous|unacceptable|furious|livid|outrageous|fed up)\b/,
      /\b(no one|nobody) (ever )?(called|showed|came|got back)\b/,
      /\b(terrible|awful|worst) (service|company|experience)\b/,
      /\bi want (to speak to|a) (a )?(manager|supervisor|human|person)\b/,
      /\b(sick of|tired of) (this|waiting|being)\b/,
    ],
  },
  {
    sentiment: Sentiment.FRUSTRATION,
    patterns: [
      /\b(third|second|fourth) time\b/,
      /\b(again|still) (waiting|nothing|no one)\b/,
      /\bi already (told|said|gave)\b/,
      /\bthis is taking (forever|too long)\b/,
    ],
  },
  {
    sentiment: Sentiment.CONFUSION,
    patterns: [
      /\bi (don'?t|do not) (understand|know what you mean|follow)\b/,
      /\bwhat do you mean\b/,
      /\b(confused|confusing)\b/,
      /\bcan you (explain|say that again|repeat)\b/,
      /\bi'?m not sure what\b/,
    ],
  },
  {
    sentiment: Sentiment.URGENCY,
    patterns: [
      /\b(asap|right away|immediately|urgent|emergency)\b/,
      /\b(today|tonight|this morning|right now)\b/,
      /\bas soon as (possible|you can)\b/,
      /\bcan'?t wait\b/,
    ],
  },
  {
    sentiment: Sentiment.RELIEF,
    patterns: [
      /\b(thank you so much|thanks so much|really appreciate|appreciate it)\b/,
      /\b(perfect|wonderful|great, thank)\b/,
      /\bthat'?s a (relief|load off)\b/,
    ],
  },
];

/**
 * Refusals that contain urgency words without being urgent.
 *
 * "I don't want an appointment right now" matches the urgency vocabulary while
 * meaning its opposite, and reading it as urgency makes the receptionist press
 * exactly the caller who just asked it not to. Negation is the one place where
 * a bag-of-words read is wrong often enough to be worth handling explicitly.
 */
const NEGATED_URGENCY =
  /\b(no thanks|not? (interested|ready|now)|don'?t|do not|doesn'?t|can'?t)\b[^.!?]{0,30}\b(want|need|right now|today|asap)\b/;

export class SentimentAnalyzer {
  /** Classify one caller turn. Returns NEUTRAL when nothing matches. */
  analyze(text: string): Sentiment {
    const normalized = text.toLowerCase();
    for (const rule of RULES) {
      if (rule.sentiment === Sentiment.URGENCY && NEGATED_URGENCY.test(normalized)) {
        continue;
      }
      if (rule.patterns.some((pattern) => pattern.test(normalized))) {
        return rule.sentiment;
      }
    }
    return Sentiment.NEUTRAL;
  }

  /**
   * Whether this sentiment means stop selling and start helping. Booking a visit
   * to someone who is angry or panicking reads as tone-deaf and loses the call.
   */
  static suppressesSelling(sentiment: Sentiment): boolean {
    return (
      sentiment === Sentiment.PANIC ||
      sentiment === Sentiment.ANGER ||
      sentiment === Sentiment.FRUSTRATION
    );
  }
}
