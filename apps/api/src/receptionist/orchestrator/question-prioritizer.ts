import { LeadCompletenessTracker } from './lead-completeness';
import {
  AppointmentProgress,
  CallDisposition,
  LeadField,
  Sentiment,
  type ConversationState,
} from './types';

/**
 * Question prioritizer.
 *
 * Decides the single highest-value thing to ask next. Questions are never asked
 * in the order they occur to the model, and never at random: the order is a
 * property of the situation, and the situation is owned here.
 *
 * The emergency order is not the normal order. When water is coming through a
 * ceiling, the office needs to know where to send a crew and how to call back —
 * a property-type question in that moment is worse than useless, because it
 * spends the caller's patience on something nobody will read.
 */

/** Water first, then where, then how to reach them. Name still required, later. */
const EMERGENCY_ORDER: readonly LeadField[] = [
  LeadField.ROOF_PROBLEM,
  LeadField.ADDRESS,
  LeadField.PHONE,
  LeadField.NAME,
  LeadField.ACTIVE_LEAK,
  LeadField.APPOINTMENT,
] as const;

/** Who am I talking to, what is wrong, where, what kind of building, when. */
const STANDARD_ORDER: readonly LeadField[] = [
  LeadField.NAME,
  LeadField.ROOF_PROBLEM,
  LeadField.ADDRESS,
  LeadField.PROPERTY_TYPE,
  LeadField.PHONE,
  LeadField.APPOINTMENT,
  LeadField.CITY,
  LeadField.CALLBACK_PREFERENCE,
] as const;

/** Only relevant once storm or hail is on the table. */
const STORM_FOLLOW_UPS: readonly LeadField[] = [
  LeadField.STORM_DAMAGE,
  LeadField.INSURANCE,
] as const;

export class QuestionPrioritizer {
  constructor(private readonly completeness = new LeadCompletenessTracker()) {}

  /**
   * The next field to pursue, or null when nothing should be asked — either
   * everything is collected, or this is not a call where asking is appropriate.
   */
  next(state: ConversationState): LeadField | null {
    if (state.disposition !== CallDisposition.HOMEOWNER) {
      // Wrong numbers, solicitations, and silence get no qualification at all.
      return null;
    }

    const order = state.emergency ? EMERGENCY_ORDER : STANDARD_ORDER;
    const storm = this.stormRelevant(state) ? STORM_FOLLOW_UPS : [];

    for (const field of [...order, ...storm]) {
      if (this.completeness.has(state, field)) continue;
      if (!this.shouldAsk(state, field)) continue;
      return field;
    }
    return null;
  }

  /**
   * Whether a field is worth a question right now. Keeps the receptionist from
   * asking things that are irrelevant, already implied, or tactless.
   */
  private shouldAsk(state: ConversationState, field: LeadField): boolean {
    switch (field) {
      case LeadField.APPOINTMENT:
        // Never pitch a visit to someone who is panicking or angry, and never
        // re-pitch one they have already turned down.
        return (
          !suppressesBooking(state.sentiment) &&
          state.appointment !== AppointmentProgress.DECLINED &&
          this.completeness.missingMandatory(state).length === 0
        );

      case LeadField.INSURANCE:
      case LeadField.STORM_DAMAGE:
        return this.stormRelevant(state);

      case LeadField.CITY:
        // Usually arrives inside the address; only worth asking when it did not.
        return this.completeness.has(state, LeadField.ADDRESS);

      case LeadField.CALLBACK_PREFERENCE:
        // A nicety, and only once the essentials are done.
        return this.completeness.missingMandatory(state).length === 0;

      case LeadField.PROPERTY_TYPE:
        // Usually inferable from what the caller described; asking outright is
        // a last resort rather than a routine question.
        return state.callerTurns >= 3;

      default:
        return true;
    }
  }

  private stormRelevant(state: ConversationState): boolean {
    const problem = (state.collected[LeadField.ROOF_PROBLEM] ?? '').toLowerCase();
    return /\b(storm|hail|wind|tornado|hurricane|tree)\b/.test(problem);
  }
}

/** Booking pressure is wrong while someone is upset — see the planner. */
function suppressesBooking(sentiment: Sentiment): boolean {
  return (
    sentiment === Sentiment.PANIC ||
    sentiment === Sentiment.ANGER ||
    sentiment === Sentiment.FRUSTRATION
  );
}
