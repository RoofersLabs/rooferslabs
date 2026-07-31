/**
 * Vocabulary of the conversation orchestrator.
 *
 * Everything the receptionist knows about a call lives in {@link ConversationState},
 * which is owned by the application rather than by the model. The model is asked
 * to write one natural-language turn at a time; it is never asked to remember
 * what has been collected, what is missing, or what should happen next.
 */

/** Where the call is in its arc. The orchestrator owns transitions. */
export enum ConversationStage {
  GREETING = 'GREETING',
  INTENT_DETECTION = 'INTENT_DETECTION',
  RAPPORT = 'RAPPORT',
  NAME_COLLECTION = 'NAME_COLLECTION',
  PROBLEM_DISCOVERY = 'PROBLEM_DISCOVERY',
  QUALIFICATION = 'QUALIFICATION',
  ADDRESS_COLLECTION = 'ADDRESS_COLLECTION',
  APPOINTMENT_SCHEDULING = 'APPOINTMENT_SCHEDULING',
  CONFIRMATION = 'CONFIRMATION',
  CLOSING = 'CLOSING',
}

/** Emotional read of the caller, used to choose register — not to score them. */
export enum Sentiment {
  PANIC = 'PANIC',
  ANGER = 'ANGER',
  CONFUSION = 'CONFUSION',
  URGENCY = 'URGENCY',
  FRUSTRATION = 'FRUSTRATION',
  RELIEF = 'RELIEF',
  NEUTRAL = 'NEUTRAL',
}

/** Everything a complete lead contains. Tracked individually so the
 *  orchestrator always knows precisely what is still outstanding. */
export enum LeadField {
  NAME = 'NAME',
  PHONE = 'PHONE',
  ADDRESS = 'ADDRESS',
  CITY = 'CITY',
  PROPERTY_TYPE = 'PROPERTY_TYPE',
  ROOF_PROBLEM = 'ROOF_PROBLEM',
  STORM_DAMAGE = 'STORM_DAMAGE',
  ACTIVE_LEAK = 'ACTIVE_LEAK',
  INSURANCE = 'INSURANCE',
  CALLBACK_PREFERENCE = 'CALLBACK_PREFERENCE',
  APPOINTMENT = 'APPOINTMENT',
}

/** How far the booking conversation has got. */
export enum AppointmentProgress {
  NOT_DISCUSSED = 'NOT_DISCUSSED',
  OFFERED = 'OFFERED',
  HESITANT = 'HESITANT',
  AGREED = 'AGREED',
  DECLINED = 'DECLINED',
}

/** Objections the caller has raised, so a second push is never made. */
export enum ObjectionType {
  JUST_LOOKING = 'JUST_LOOKING',
  CALL_BACK_LATER = 'CALL_BACK_LATER',
  ASK_SPOUSE = 'ASK_SPOUSE',
  COMPARING_QUOTES = 'COMPARING_QUOTES',
  PRICE_ONLY = 'PRICE_ONLY',
  NOT_READY = 'NOT_READY',
  UNSURE = 'UNSURE',
}

/** Why the call is not a normal homeowner lead, when it isn't one. */
export enum CallDisposition {
  HOMEOWNER = 'HOMEOWNER',
  COMMERCIAL = 'COMMERCIAL',
  EXISTING_CUSTOMER = 'EXISTING_CUSTOMER',
  WRONG_NUMBER = 'WRONG_NUMBER',
  SOLICITATION = 'SOLICITATION',
  NON_RESPONSIVE = 'NON_RESPONSIVE',
}

/** What kind of emotional handling the next turn needs. */
export enum EmpathyLevel {
  NONE = 'NONE',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
  REASSURE = 'REASSURE',
  DE_ESCALATE = 'DE_ESCALATE',
}

export interface ClarificationState {
  /** Field currently being clarified, if any. */
  topic: LeadField | null;
  /** Attempts spent on the current topic. Capped — see ClarificationManager. */
  attempts: number;
  /** Every wording already used for the current topic, so none is reused. */
  usedPhrasings: string[];
}

export interface EscalationState {
  /** True once a human handoff should be offered or performed. */
  recommended: boolean;
  reason: string | null;
  /** The caller asked for a person outright. */
  requestedByCaller: boolean;
}

/** The complete, authoritative picture of a call. */
export interface ConversationState {
  stage: ConversationStage;
  previousStage: ConversationStage | null;
  disposition: CallDisposition;

  /** Collected lead values, keyed by field. Absent = not yet known. */
  collected: Partial<Record<LeadField, string>>;

  sentiment: Sentiment;
  /** Sentiment for each caller turn, oldest first — lets the planner see a trend. */
  sentimentHistory: Sentiment[];

  emergency: boolean;
  emergencyReason: string | null;

  appointment: AppointmentProgress;
  /** Objections already raised. Each gets at most one soft re-ask, ever. */
  objections: ObjectionType[];

  clarification: ClarificationState;
  escalation: EscalationState;

  /** Rolling confidence that the last caller turn was understood (0–1). */
  confidence: number;

  /** True between a barge-in and the resumption of the interrupted topic. */
  interrupted: boolean;
  /** What the receptionist was in the middle of when the caller barged in. */
  pendingTopic: LeadField | null;

  callerTurns: number;
  assistantTurns: number;
  /** How many times the caller's first name has been used aloud. */
  nameUsageCount: number;
  /** Assistant turns so far, normalized — used to detect repetition. */
  recentAssistantTurns: string[];
}

/**
 * The instruction set for a single upcoming turn. Produced by the planner from
 * state; rendered into the compact text the model actually receives.
 */
export interface TurnPlan {
  stage: ConversationStage;
  /** One sentence describing what this turn must achieve. */
  objective: string;
  /** The field this turn should collect, when it is collecting one. */
  targetField: LeadField | null;
  empathy: EmpathyLevel;
  /** Set when the previous answer was not understood and must be re-asked differently. */
  clarify: { topic: LeadField; attempt: number } | null;
  /** The tool the application expects to be called on this turn, if any. */
  expectedTool: string | null;
  /** Hard limits for this turn. */
  maxSentences: number;
  /** First name to use naturally in this turn, or null when it would be too much. */
  useFirstName: string | null;
  /** Things the model must not do this turn, derived from state. */
  prohibitions: string[];
  /** Fields already known — never asked for again. */
  alreadyKnown: LeadField[];
}

/** A problem found in an assistant turn after the fact. */
export interface QualityFinding {
  code:
    | 'TOO_VERBOSE'
    | 'REPETITIVE'
    | 'ASKED_KNOWN_FIELD'
    | 'MULTIPLE_QUESTIONS'
    | 'AI_DISCLOSURE'
    | 'NO_FORWARD_MOTION'
    | 'MISSING_EMPATHY';
  detail: string;
}
