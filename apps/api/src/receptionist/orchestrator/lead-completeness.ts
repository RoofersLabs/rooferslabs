import { CallDisposition, LeadField, type ConversationState } from './types';

/**
 * Lead completeness tracker.
 *
 * Knows which fields a usable lead contains, which are mandatory, and which of
 * those are still outstanding. It is the single place that answers "what do we
 * still need?", so the planner and the prompt can never disagree about it.
 */

/** Fields without which the office cannot act on the lead at all. */
const MANDATORY: readonly LeadField[] = [
  LeadField.NAME,
  LeadField.PHONE,
  LeadField.ROOF_PROBLEM,
] as const;

/**
 * Fields that make a lead actionable rather than merely recorded. Weighted so
 * the completeness score reflects usefulness to the office, not field count.
 */
const WEIGHTS: Record<LeadField, number> = {
  [LeadField.NAME]: 3,
  [LeadField.PHONE]: 3,
  [LeadField.ROOF_PROBLEM]: 3,
  [LeadField.ADDRESS]: 2,
  [LeadField.CITY]: 1,
  [LeadField.PROPERTY_TYPE]: 1,
  [LeadField.ACTIVE_LEAK]: 1,
  [LeadField.STORM_DAMAGE]: 1,
  [LeadField.INSURANCE]: 1,
  [LeadField.CALLBACK_PREFERENCE]: 1,
  [LeadField.APPOINTMENT]: 2,
};

export class LeadCompletenessTracker {
  /** Fields already captured. */
  known(state: ConversationState): LeadField[] {
    return Object.values(LeadField).filter((field) => this.has(state, field));
  }

  /** Fields still outstanding, mandatory ones first. */
  missing(state: ConversationState): LeadField[] {
    const outstanding = Object.values(LeadField).filter((field) => !this.has(state, field));
    return outstanding.sort((a, b) => (WEIGHTS[b] ?? 0) - (WEIGHTS[a] ?? 0));
  }

  /** Mandatory fields still outstanding. Empty means the lead is usable. */
  missingMandatory(state: ConversationState): LeadField[] {
    return MANDATORY.filter((field) => !this.has(state, field));
  }

  has(state: ConversationState, field: LeadField): boolean {
    const value = state.collected[field];
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * 0–100, weighted by how much each field actually helps the office. Used for
   * logging and for deciding whether a call is complete enough to close.
   */
  score(state: ConversationState): number {
    const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    const earned = Object.values(LeadField)
      .filter((field) => this.has(state, field))
      .reduce((sum, field) => sum + (WEIGHTS[field] ?? 0), 0);
    return Math.round((earned / total) * 100);
  }

  /**
   * Whether the call may move to closing.
   *
   * The name is mandatory on every legitimate homeowner call, so a call that has
   * everything else but no name is NOT ready to close — that is the rule this
   * method exists to enforce. Calls that are not leads (wrong number, a sales
   * call, silence) are exempt: holding a robocall hostage for a name is absurd.
   */
  readyToClose(state: ConversationState): boolean {
    if (state.disposition !== CallDisposition.HOMEOWNER) return true;
    return this.missingMandatory(state).length === 0;
  }
}
