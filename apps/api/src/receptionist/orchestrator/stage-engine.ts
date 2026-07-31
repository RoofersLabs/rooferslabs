import { LeadCompletenessTracker } from './lead-completeness';
import {
  AppointmentProgress,
  CallDisposition,
  ConversationStage,
  LeadField,
  type ConversationState,
} from './types';

/**
 * Stage transition engine.
 *
 * The stage is derived from what is actually true about the call, not advanced
 * by a counter and not chosen by the model. Deriving it means the conversation
 * can move backwards — a caller who mentions a second problem during
 * confirmation belongs back in discovery — which a forward-only state machine
 * cannot express and which real phone calls do constantly.
 */
export class StageTransitionEngine {
  constructor(private readonly completeness = new LeadCompletenessTracker()) {}

  /** The stage the call is in, given everything known so far. */
  resolve(state: ConversationState): ConversationStage {
    // Calls that are not leads never enter the qualification arc at all.
    if (state.disposition !== CallDisposition.HOMEOWNER) {
      return ConversationStage.CLOSING;
    }

    // An emergency overrides the arc: discovery until we know where to send a
    // crew, then straight to confirming how to reach them.
    if (state.emergency) {
      if (!this.completeness.has(state, LeadField.ADDRESS)) {
        return ConversationStage.ADDRESS_COLLECTION;
      }
      if (!this.completeness.has(state, LeadField.PHONE)) {
        return ConversationStage.CONFIRMATION;
      }
      if (!this.completeness.has(state, LeadField.NAME)) {
        return ConversationStage.NAME_COLLECTION;
      }
      return ConversationStage.CONFIRMATION;
    }

    if (state.callerTurns === 0) return ConversationStage.GREETING;

    // Intent before anything else: until the caller has said why they rang,
    // every question is a guess.
    if (!this.completeness.has(state, LeadField.ROOF_PROBLEM)) {
      return state.callerTurns <= 1
        ? ConversationStage.INTENT_DETECTION
        : ConversationStage.PROBLEM_DISCOVERY;
    }

    // The name is mandatory and is collected early, once there is enough rapport
    // that asking does not feel like a form.
    if (!this.completeness.has(state, LeadField.NAME)) {
      return ConversationStage.NAME_COLLECTION;
    }

    if (!this.completeness.has(state, LeadField.ADDRESS)) {
      return ConversationStage.ADDRESS_COLLECTION;
    }

    if (this.completeness.missingMandatory(state).length > 0) {
      return ConversationStage.QUALIFICATION;
    }

    if (
      state.appointment === AppointmentProgress.NOT_DISCUSSED ||
      state.appointment === AppointmentProgress.OFFERED ||
      state.appointment === AppointmentProgress.HESITANT
    ) {
      return ConversationStage.APPOINTMENT_SCHEDULING;
    }

    if (!this.completeness.has(state, LeadField.PHONE)) {
      return ConversationStage.CONFIRMATION;
    }

    return this.completeness.readyToClose(state)
      ? ConversationStage.CLOSING
      : ConversationStage.QUALIFICATION;
  }

  /**
   * Whether rapport is worth a beat before the next question. Only early, only
   * once, and never when someone is in trouble — small talk during an emergency
   * is what makes an automated system feel like one.
   */
  wantsRapport(state: ConversationState): boolean {
    return (
      !state.emergency &&
      state.callerTurns === 1 &&
      state.stage === ConversationStage.INTENT_DETECTION
    );
  }
}
