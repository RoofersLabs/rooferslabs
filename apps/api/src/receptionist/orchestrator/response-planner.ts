import { ClarificationManager } from './clarification';
import { LeadCompletenessTracker } from './lead-completeness';
import { QuestionPrioritizer } from './question-prioritizer';
import { StageTransitionEngine } from './stage-engine';
import { TOOL } from '../tools';
import {
  AppointmentProgress,
  CallDisposition,
  ConversationStage,
  EmpathyLevel,
  LeadField,
  Sentiment,
  type ConversationState,
  type TurnPlan,
} from './types';

/** How often the caller's first name may be used before it starts to grate. */
const NAME_USAGE_CEILING = 4;

/** Plain-English objective text per field, written for the model to act on. */
const FIELD_OBJECTIVE: Record<LeadField, string> = {
  [LeadField.NAME]: "Get the caller's name, naturally and in your own words.",
  [LeadField.PHONE]: 'Get the best callback number.',
  [LeadField.ADDRESS]: 'Get the property address — street and city is enough.',
  [LeadField.CITY]: 'Find out which city or town the property is in.',
  [LeadField.PROPERTY_TYPE]: 'Establish whether this is a house or a commercial building.',
  [LeadField.ROOF_PROBLEM]: 'Find out what is actually going on with the roof.',
  [LeadField.STORM_DAMAGE]: 'Find out whether recent storm or hail is involved.',
  [LeadField.ACTIVE_LEAK]: 'Find out whether water is coming in right now.',
  [LeadField.INSURANCE]: 'Ask whether they have started, or plan to start, an insurance claim.',
  [LeadField.CALLBACK_PREFERENCE]: 'Find out the best time and way to reach them.',
  [LeadField.APPOINTMENT]: 'Get a visit on the books — assume it rather than asking permission.',
};

/**
 * Response planner.
 *
 * Turns state into a single instruction for the next turn: what it must achieve,
 * how much empathy it needs, what it may not do, and how long it may be. The
 * model then writes that turn in natural language and does nothing else — no
 * deciding what to ask, no remembering what was asked.
 */
export class ResponsePlanner {
  constructor(
    private readonly completeness = new LeadCompletenessTracker(),
    private readonly prioritizer = new QuestionPrioritizer(completeness),
    private readonly stages = new StageTransitionEngine(completeness),
    private readonly clarification = new ClarificationManager(),
  ) {}

  plan(state: ConversationState): TurnPlan {
    const stage = state.stage;
    const known = this.completeness.known(state);
    const empathy = this.empathyFor(state);
    const prohibitions = this.prohibitionsFor(state);

    // A clarification in progress outranks everything: re-asking beats moving on
    // with a value that was probably misheard.
    const clarifyTopic = state.clarification.topic;
    if (clarifyTopic && !this.clarification.isExhausted(state, clarifyTopic)) {
      return {
        stage,
        objective: `You did not catch the ${label(clarifyTopic)}. Ask again in COMPLETELY different words than you used before.`,
        targetField: clarifyTopic,
        empathy,
        clarify: { topic: clarifyTopic, attempt: state.clarification.attempts },
        expectedTool: null,
        maxSentences: 1,
        useFirstName: this.firstNameFor(state),
        prohibitions: [
          ...prohibitions,
          'Do not repeat your previous wording for this question.',
          'Do not apologize more than once for not catching it.',
        ],
        alreadyKnown: known,
      };
    }

    if (state.escalation.recommended) {
      return {
        stage,
        objective:
          'Offer to put the caller through to someone on the team, warmly and without making it sound like a failure.',
        targetField: null,
        empathy: EmpathyLevel.DE_ESCALATE,
        clarify: null,
        expectedTool: TOOL.TRANSFER_TO_HUMAN,
        maxSentences: 2,
        useFirstName: this.firstNameFor(state),
        prohibitions: [...prohibitions, 'Do not ask any further qualifying questions.'],
        alreadyKnown: known,
      };
    }

    if (state.disposition !== CallDisposition.HOMEOWNER) {
      return {
        stage: ConversationStage.CLOSING,
        objective: this.nonLeadObjective(state.disposition),
        targetField: null,
        empathy: EmpathyLevel.NONE,
        clarify: null,
        expectedTool: TOOL.END_CALL,
        maxSentences: 1,
        useFirstName: null,
        prohibitions: [
          'Do not qualify this caller.',
          'Do not ask for any details.',
          'Do not offer an appointment.',
        ],
        alreadyKnown: known,
      };
    }

    if (state.emergency && !this.completeness.has(state, LeadField.ADDRESS)) {
      return {
        stage: ConversationStage.ADDRESS_COLLECTION,
        objective:
          'Reassure them briefly, then get the property address so a crew can be sent. Nothing else matters yet.',
        targetField: LeadField.ADDRESS,
        empathy: EmpathyLevel.REASSURE,
        clarify: null,
        expectedTool: TOOL.CAPTURE_CUSTOMER_INFO,
        maxSentences: 2,
        useFirstName: this.firstNameFor(state),
        prohibitions: [
          ...prohibitions,
          'Do not ask about property type, insurance, or scheduling yet.',
        ],
        alreadyKnown: known,
      };
    }

    const target = this.prioritizer.next(state);

    if (!target) {
      return {
        stage: ConversationStage.CLOSING,
        objective: this.completeness.readyToClose(state)
          ? 'Confirm what happens next, ask if there is anything else, and close warmly.'
          : 'You still do not have everything, but there is nothing appropriate left to ask. Confirm what happens next and close.',
        targetField: null,
        empathy,
        clarify: null,
        expectedTool: null,
        maxSentences: 2,
        useFirstName: this.firstNameFor(state),
        prohibitions,
        alreadyKnown: known,
      };
    }

    return {
      stage,
      objective: this.objectiveFor(state, target),
      targetField: target,
      empathy,
      clarify: null,
      expectedTool:
        target === LeadField.APPOINTMENT ? TOOL.REQUEST_APPOINTMENT : TOOL.CAPTURE_CUSTOMER_INFO,
      maxSentences: empathy === EmpathyLevel.NONE ? 2 : 3,
      useFirstName: this.firstNameFor(state),
      prohibitions,
      alreadyKnown: known,
    };
  }

  private objectiveFor(state: ConversationState, field: LeadField): string {
    const base = FIELD_OBJECTIVE[field];

    if (field === LeadField.NAME && state.callerTurns >= 1) {
      // The mandatory field. Framed so it lands as courtesy, not data entry.
      return `${base} Ask because you want to know who you are speaking with, not because a form needs filling.`;
    }

    if (field === LeadField.APPOINTMENT && state.appointment === AppointmentProgress.HESITANT) {
      return 'They hesitated about a visit. Make it smaller and easier ONCE — then accept whatever they say and move on.';
    }

    if (this.stages.wantsRapport(state)) {
      return `Acknowledge what they just told you in one short line first, then: ${base}`;
    }

    return base;
  }

  private nonLeadObjective(disposition: CallDisposition): string {
    switch (disposition) {
      case CallDisposition.WRONG_NUMBER:
        return 'Wrong number. One friendly line, then let them go.';
      case CallDisposition.SOLICITATION:
        return 'This is a sales call. One polite line that we are not interested, then end it.';
      case CallDisposition.NON_RESPONSIVE:
        return 'Nobody is responding. Say you will have someone follow up, then end the call.';
      case CallDisposition.EXISTING_CUSTOMER:
        return 'Existing customer about work already done. Take the details and route it as a follow-up. Do not sell anything.';
      default:
        return 'Close the call politely.';
    }
  }

  private empathyFor(state: ConversationState): EmpathyLevel {
    switch (state.sentiment) {
      case Sentiment.PANIC:
        return EmpathyLevel.REASSURE;
      case Sentiment.ANGER:
      case Sentiment.FRUSTRATION:
        return EmpathyLevel.DE_ESCALATE;
      case Sentiment.CONFUSION:
        return EmpathyLevel.REASSURE;
      case Sentiment.URGENCY:
        return EmpathyLevel.ACKNOWLEDGE;
      default:
        return state.emergency ? EmpathyLevel.REASSURE : EmpathyLevel.NONE;
    }
  }

  private prohibitionsFor(state: ConversationState): string[] {
    const out: string[] = [];

    if (state.objections.length > 0) {
      out.push(
        `They already pushed back (${state.objections.join(', ')}). Do not raise it again — accept it and keep the call warm.`,
      );
    }
    if (state.appointment === AppointmentProgress.DECLINED) {
      out.push('They declined a visit. Do not offer one again.');
    }
    if (Sentiment.ANGER === state.sentiment || Sentiment.FRUSTRATION === state.sentiment) {
      out.push('Do not sell, do not explain, do not defend. Acknowledge and act.');
    }
    if (state.emergency) {
      out.push('Do not ask anything that is not needed to get a crew moving.');
    }
    if (state.interrupted) {
      out.push('You were interrupted. Answer what they said — do not restart the topic.');
    }
    return out;
  }

  /**
   * The first name, when using it would sound natural rather than performed.
   * Withheld once it has been used enough that another would read as a sales
   * technique, which is exactly how it lands on a real call.
   */
  private firstNameFor(state: ConversationState): string | null {
    const full = state.collected[LeadField.NAME];
    if (!full) return null;
    if (state.nameUsageCount >= NAME_USAGE_CEILING) return null;
    // Only every other turn, so it punctuates rather than pads.
    if (state.assistantTurns > 0 && state.assistantTurns % 2 === 1) return null;

    const first = full.trim().split(/\s+/)[0];
    return first && first.length > 1 ? first : null;
  }
}

function label(field: LeadField): string {
  return field.toLowerCase().replace(/_/g, ' ');
}
