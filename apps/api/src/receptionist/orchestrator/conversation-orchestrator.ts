import { ClarificationManager } from './clarification';
import { EscalationPolicy } from './escalation';
import { renderGuidance } from './guidance';
import { LeadCompletenessTracker } from './lead-completeness';
import { QualityValidator } from './quality-validator';
import { ResponsePlanner } from './response-planner';
import { SentimentAnalyzer } from './sentiment';
import { StageTransitionEngine } from './stage-engine';
import { TOOL } from '../tools';
import {
  AppointmentProgress,
  CallDisposition,
  ConversationStage,
  LeadField,
  ObjectionType,
  Sentiment,
  type ConversationState,
  type QualityFinding,
  type TurnPlan,
} from './types';

/** Assistant turns kept for repetition detection. Enough to catch a loop. */
const TURN_HISTORY = 6;

/** Objection phrasings, matched against the caller's own words. */
const OBJECTION_PATTERNS: [ObjectionType, RegExp][] = [
  [ObjectionType.JUST_LOOKING, /\b(just (looking|browsing|curious)|no rush|not urgent)\b/i],
  [
    ObjectionType.CALL_BACK_LATER,
    /\b(call (you )?back|call later|another time|not a good time)\b/i,
  ],
  [ObjectionType.ASK_SPOUSE, /\b(ask|talk to|check with) my (husband|wife|spouse|partner)\b/i],
  [
    ObjectionType.COMPARING_QUOTES,
    /\b(other (quotes|companies|estimates)|shopping around|comparing)\b/i,
  ],
  [ObjectionType.PRICE_ONLY, /\b(just (want|wanted|need) a (price|quote|ballpark|estimate))\b/i],
  [ObjectionType.NOT_READY, /\b(not ready|don'?t want to (schedule|commit)|maybe later)\b/i],
  [ObjectionType.UNSURE, /\b(i (don'?t|do not) know|not sure|no idea)\b/i],
];

const WRONG_NUMBER = /\b(wrong number|didn'?t mean to call|sorry, wrong|butt dial|pocket dial)\b/i;
const SOLICITATION =
  /\b(calling (from|on behalf of)|this is a (courtesy|business) call|SEO|marketing|leads for your business|final notice)\b/i;
const EXISTING_CUSTOMER =
  /\b(you (guys )?(did|installed|replaced) my roof|last (year|month|week) you|already (a )?customer|work you did)\b/i;

/**
 * Conversation orchestrator.
 *
 * One instance per live call. It owns the conversation state, updates it from
 * every observable event, decides what the next turn must achieve, and renders
 * that decision as guidance for the model. The model's only remaining job is to
 * say the thing well.
 *
 * WHAT THIS CAN AND CANNOT ENFORCE, on the Realtime transport:
 *
 * The session runs server VAD with `create_response: true`, so the model begins
 * speaking the instant the caller stops — before the caller's transcript has
 * been produced. There is therefore no point at which a turn can be inspected,
 * approved, and then released, and no way to gate a response on the text of the
 * turn that prompted it without taking over turn-taking and paying transcription
 * latency on every exchange.
 *
 * So the loop is: observe the turn, update state, and inject guidance at the
 * turn boundary, where it is in context for everything that follows. Tool calls
 * update state synchronously and authoritatively, so what has been collected is
 * always exact. Transcript-derived signals — sentiment, objections, disposition
 * — take effect from the next turn. Quality findings are corrections fed
 * forward, not a gate.
 *
 * Calling that "the orchestrator decides and the LLM only writes" is true of
 * state, priorities, and stage. It is not true of the individual words of the
 * turn already in flight, and pretending otherwise would be the kind of claim
 * that gets discovered in production.
 */
export class ConversationOrchestrator {
  private readonly state: ConversationState;
  private lastPlan: TurnPlan | null = null;
  private pendingCorrections: string[] = [];
  private lastFindings: QualityFinding[] = [];

  constructor(
    private readonly transferAvailable = false,
    private readonly completeness = new LeadCompletenessTracker(),
    private readonly sentiment = new SentimentAnalyzer(),
    private readonly stages = new StageTransitionEngine(completeness),
    private readonly planner = new ResponsePlanner(completeness),
    private readonly clarification = new ClarificationManager(),
    private readonly escalation = new EscalationPolicy(),
    private readonly quality = new QualityValidator(completeness),
  ) {
    this.state = createInitialState();
  }

  /** Read-only view of the current state, for logging and persistence. */
  snapshot(): Readonly<ConversationState> {
    return this.state;
  }

  /**
   * Record the caller's number from caller ID, before the call has started.
   *
   * This is what makes "never ask for the phone number" deterministic instead of
   * a line in the prompt the model may or may not honour. Once PHONE is in
   * `collected`, the question prioritizer skips it entirely, the stage engine
   * stops routing through CONFIRMATION to chase it, the guidance lists it under
   * "already known (never ask again)", and the quality validator raises
   * ASKED_KNOWN_FIELD against any turn that asks anyway — none of which depend
   * on the model reading anything.
   *
   * Not a general seeding hook on purpose: the caller ID is the one field the
   * application knows independently of the conversation. A CRM match is NOT
   * seeded here — the person on the phone may be a spouse or a tenant, so a name
   * on file is a lead to confirm, not a collected value.
   */
  seedCallerNumber(phone: string): void {
    const text = asText(phone);
    if (!text) return;
    this.state.collected[LeadField.PHONE] = text;
    this.refreshStage();
  }

  /** Fields the office still needs — the same answer the planner works from. */
  missingFields(): LeadField[] {
    return this.completeness.missing(this.state);
  }

  completenessScore(): number {
    return this.completeness.score(this.state);
  }

  /** The caller barged in. Remember what was in flight so it can be resumed. */
  observeInterruption(): void {
    this.state.interrupted = true;
    this.state.pendingTopic = this.lastPlan?.targetField ?? null;
  }

  /**
   * A completed caller turn. Updates sentiment, disposition, objections,
   * confidence, escalation, and the stage.
   */
  observeCallerTurn(transcript: string): void {
    const text = transcript.trim();
    this.state.callerTurns += 1;
    this.state.confidence = ClarificationManager.estimateConfidence(text);

    const mood = this.sentiment.analyze(text);
    this.state.sentiment = mood;
    this.state.sentimentHistory.push(mood);

    this.detectDisposition(text);
    this.detectObjections(text);
    this.detectAppointmentSignals(text);

    if (EscalationPolicy.detectRequest(text)) {
      this.state.escalation.requestedByCaller = true;
    }

    // A low-confidence turn on a field we are actively collecting is what starts
    // a clarification loop — not a generic "I didn't understand".
    const target = this.lastPlan?.targetField ?? null;
    if (target && this.state.confidence < 0.5) {
      this.clarification.begin(this.state, target);
    } else if (this.state.clarification.topic && this.state.confidence >= 0.5) {
      this.clarification.resolve(this.state);
    }

    this.escalation.evaluate(this.state, this.transferAvailable);
    this.state.interrupted = false;
    this.refreshStage();
  }

  /** A completed assistant turn. Runs the quality pass and tracks repetition. */
  observeAssistantTurn(transcript: string): QualityFinding[] {
    const text = transcript.trim();
    if (!text) return [];

    this.state.assistantTurns += 1;

    const findings = this.lastPlan ? this.quality.validate(text, this.lastPlan, this.state) : [];
    this.lastFindings = findings;
    this.pendingCorrections = this.quality.corrections(findings);

    if (this.lastPlan?.useFirstName && text.includes(this.lastPlan.useFirstName)) {
      this.state.nameUsageCount += 1;
    }
    if (this.lastPlan?.clarify) {
      this.clarification.recordPhrasing(this.state, text);
    }

    this.state.recentAssistantTurns.push(text);
    if (this.state.recentAssistantTurns.length > TURN_HISTORY) {
      this.state.recentAssistantTurns.shift();
    }

    return findings;
  }

  /**
   * A tool call the model made. This is the authoritative path for collected
   * values — it is structured, so unlike the transcript it cannot be
   * misinterpreted, and it lands synchronously.
   */
  observeToolCall(toolName: string, args: Record<string, unknown>): void {
    switch (toolName) {
      case TOOL.CAPTURE_CUSTOMER_INFO: {
        this.set(LeadField.NAME, args.fullName);
        this.set(LeadField.PHONE, args.phone);
        this.set(LeadField.ADDRESS, args.propertyAddress);
        this.set(LeadField.PROPERTY_TYPE, args.propertyType);
        this.set(LeadField.ROOF_PROBLEM, args.reason);
        this.set(LeadField.INSURANCE, args.insuranceClaim);

        const address = asText(args.propertyAddress);
        if (address) {
          const city = extractCity(address);
          if (city) this.set(LeadField.CITY, city);
        }
        const reason = asText(args.reason);
        if (reason) {
          if (/\b(storm|hail|wind|tornado|hurricane)\b/i.test(reason)) {
            this.set(LeadField.STORM_DAMAGE, 'yes');
          }
          if (/\b(leak|leaking|water (coming|is) in|dripping)\b/i.test(reason)) {
            this.set(LeadField.ACTIVE_LEAK, 'yes');
          }
        }
        // A name arriving means any clarification loop over it is finished.
        if (this.state.clarification.topic === LeadField.NAME && args.fullName) {
          this.clarification.resolve(this.state);
        }
        break;
      }

      case TOOL.REQUEST_APPOINTMENT: {
        this.state.appointment = AppointmentProgress.AGREED;
        const parts = [asText(args.preferredDate), asText(args.preferredTimeWindow)].filter(
          Boolean,
        );
        this.set(LeadField.APPOINTMENT, parts.join(' ') || 'requested');
        break;
      }

      case TOOL.FLAG_EMERGENCY: {
        this.state.emergency = true;
        this.state.emergencyReason = asText(args.reason) ?? null;
        this.set(LeadField.ACTIVE_LEAK, 'yes');
        if (!this.completeness.has(this.state, LeadField.ROOF_PROBLEM)) {
          this.set(LeadField.ROOF_PROBLEM, args.reason);
        }
        break;
      }

      case TOOL.TRANSFER_TO_HUMAN:
        this.state.escalation.recommended = true;
        this.state.escalation.reason ??= 'Transferred to a team member.';
        break;

      default:
        break;
    }

    this.refreshStage();
  }

  /** Plan the next turn and render the guidance the model should receive. */
  nextTurn(): { plan: TurnPlan; guidance: string } {
    const plan = this.planner.plan(this.state);
    this.lastPlan = plan;
    const guidance = renderGuidance(plan, this.state, this.pendingCorrections);
    this.pendingCorrections = [];
    return { plan, guidance };
  }

  /** Findings from the most recent assistant turn, for logging. */
  latestFindings(): QualityFinding[] {
    return this.lastFindings;
  }

  private refreshStage(): void {
    const next = this.stages.resolve(this.state);
    if (next !== this.state.stage) {
      this.state.previousStage = this.state.stage;
      this.state.stage = next;
    }
  }

  private set(field: LeadField, value: unknown): void {
    const text = asText(value);
    // Never overwrite a captured value with an empty one: a later tool call that
    // omits a field means "unchanged", not "forgotten".
    if (text) this.state.collected[field] = text;
  }

  private detectDisposition(text: string): void {
    if (this.state.disposition !== CallDisposition.HOMEOWNER) return;

    if (WRONG_NUMBER.test(text)) {
      this.state.disposition = CallDisposition.WRONG_NUMBER;
    } else if (SOLICITATION.test(text)) {
      this.state.disposition = CallDisposition.SOLICITATION;
    } else if (EXISTING_CUSTOMER.test(text)) {
      this.state.disposition = CallDisposition.EXISTING_CUSTOMER;
    }
  }

  private detectObjections(text: string): void {
    for (const [type, pattern] of OBJECTION_PATTERNS) {
      if (pattern.test(text) && !this.state.objections.includes(type)) {
        this.state.objections.push(type);
      }
    }
  }

  private detectAppointmentSignals(text: string): void {
    if (this.state.appointment === AppointmentProgress.AGREED) return;

    if (
      /\b(no thanks|not (right )?now|don'?t (want|need) (an? )?(visit|appointment|someone))\b/i.test(
        text,
      )
    ) {
      this.state.appointment = AppointmentProgress.DECLINED;
      return;
    }
    if (
      this.state.objections.length > 0 &&
      this.state.appointment === AppointmentProgress.OFFERED
    ) {
      this.state.appointment = AppointmentProgress.HESITANT;
    }
  }
}

function createInitialState(): ConversationState {
  return {
    stage: ConversationStage.GREETING,
    previousStage: null,
    disposition: CallDisposition.HOMEOWNER,
    collected: {},
    sentiment: Sentiment.NEUTRAL,
    sentimentHistory: [],
    emergency: false,
    emergencyReason: null,
    appointment: AppointmentProgress.NOT_DISCUSSED,
    objections: [],
    clarification: { topic: null, attempts: 0, usedPhrasings: [] },
    escalation: { recommended: false, reason: null, requestedByCaller: false },
    confidence: 1,
    interrupted: false,
    pendingTopic: null,
    callerTurns: 0,
    assistantTurns: 0,
    nameUsageCount: 0,
    recentAssistantTurns: [],
  };
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** "18 Balcones Dr, Austin TX 78731" → "Austin". Best effort, never guesses. */
function extractCity(address: string): string | null {
  const parts = address.split(',').map((part) => part.trim());
  const afterStreet = parts[1];
  if (!afterStreet) return null;
  const candidate = afterStreet.replace(/\b[A-Z]{2}\b.*$/, '').trim();
  return candidate.length > 1 ? candidate : null;
}
