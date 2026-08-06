import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
  type ConversationStructuredOutput,
  type TranscriptEntry,
} from '@rooferslabs/shared';
import { AppConfigService } from '../config/app-config.service';
import { CompaniesService } from '../companies/companies.service';
import { OpenAiService } from '../ai/openai.service';
import { RagService } from '../ai/rag.service';
import { buildGreeting, buildReceptionistInstructions } from './prompt.builder';
import {
  buildAnalysisInstructions,
  mergeNormalizedTranscript,
  renderTranscriptForAnalysis,
} from './normalization';
import { buildRealtimeTools, CONVERSATION_OUTPUT_SCHEMA, TOOL } from './tools';
import { type CallerContext } from './caller-context';
import { type LiveConversationSignals, type ToolExecutionResult } from './session-state';

/**
 * A fully formed OpenAI Realtime GA session (the `session` payload of
 * `session.update`). Shaped here so the telephony bridge stays a pure
 * transport: g711 μ-law in/out for Twilio, server VAD with automatic
 * response creation and interruption, and low-latency voice settings per
 * current OpenAI production guidance.
 */
export interface RealtimeGaSession {
  type: 'realtime';
  output_modalities: ['audio'];
  instructions: string;
  audio: {
    input: {
      format: { type: 'audio/pcmu' };
      transcription: { model: string };
      turn_detection: {
        type: 'server_vad';
        threshold: number;
        prefix_padding_ms: number;
        silence_duration_ms: number;
        create_response: boolean;
        interrupt_response: boolean;
      };
    };
    output: {
      format: { type: 'audio/pcmu' };
      voice: string;
    };
  };
  tools: ReturnType<typeof buildRealtimeTools>;
  tool_choice: 'auto';
}

export interface RealtimeSessionConfig {
  model: string;
  greeting: string;
  session: RealtimeGaSession;
}

/** Realtime speech-to-text model for caller transcription (GA guidance). */
const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

/**
 * How long the caller must be silent before the server calls their turn over.
 *
 * This single number is the dominant latency in the whole conversation: it is
 * added to *every* turn, before the model has even been asked to think. At the
 * previous 500ms the receptionist felt like it was considering its answer; the
 * caller finished a sentence and waited half a second in silence before
 * anything happened.
 *
 * 340ms is chosen against how people actually speak. Pauses *inside* a sentence
 * — between clauses, or while recalling a house number — cluster around 150 to
 * 250ms, so 340 still sits clear of them and does not cut a caller off
 * mid-thought. It is not pushed lower than that: the failure mode of a value
 * that is too small is clipping a caller mid-address, which is far worse than
 * feeling slightly deliberate, and every 50ms below this buys less than it
 * risks.
 *
 * Everything downstream is already streaming, so this reduction is felt in full
 * rather than being absorbed by a later stage.
 */
const TURN_END_SILENCE_MS = 340;

/**
 * How much audio before detected speech is kept.
 *
 * Left at 300ms deliberately. It does not delay the *response* — it is
 * retrospective padding on the caller's own audio — and trimming it only makes
 * it likelier the first phoneme of a turn is lost. It costs nothing to keep and
 * protects the thing hardest to recover from.
 */
const SPEECH_PREFIX_PADDING_MS = 300;

/**
 * How loud audio must be to count as speech.
 *
 * Unchanged at 0.5. Lowering it would detect speech onset marginally sooner —
 * which is really a barge-in concern, and barge-in is already handled by
 * truncation — while making the receptionist interrupt itself over a passing
 * truck or wind noise on a roof. The callers this product serves are frequently
 * standing outside next to the damage they are describing.
 */
const SPEECH_THRESHOLD = 0.5;

/**
 * The AI receptionist "brain": produces the Realtime session configuration for a
 * company, executes the model's tool calls during a call, and performs post-call
 * structured extraction/summarization via the Responses API. It is persistence
 * agnostic — the telephony (M6) and call (M7) layers own storage.
 */
@Injectable()
export class ReceptionistService {
  private readonly logger = new Logger(ReceptionistService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly companies: CompaniesService,
    private readonly openai: OpenAiService,
    private readonly rag: RagService,
  ) {}

  /**
   * Build the OpenAI Realtime GA session configuration for a company.
   *
   * `caller` carries what Twilio already told us about this call — above all the
   * caller ID. It is folded into the session instructions, which are sent in the
   * `session.update` that precedes the greeting, so the receptionist knows the
   * caller's number before it produces a single word.
   */
  async buildSessionConfig(
    companyId: string,
    caller?: CallerContext,
  ): Promise<RealtimeSessionConfig> {
    const company = await this.companies.getById(companyId);
    return {
      model: this.config.openai.realtimeModel,
      greeting: buildGreeting(company),
      session: {
        type: 'realtime',
        output_modalities: ['audio'],
        instructions: buildReceptionistInstructions(company, caller),
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            transcription: { model: TRANSCRIPTION_MODEL },
            turn_detection: {
              type: 'server_vad',
              threshold: SPEECH_THRESHOLD,
              prefix_padding_ms: SPEECH_PREFIX_PADDING_MS,
              silence_duration_ms: TURN_END_SILENCE_MS,
              // The server both starts the reply and cancels it on barge-in.
              // Doing either from here would cost a round trip across the
              // Atlantic before the caller heard anything.
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            format: { type: 'audio/pcmu' },
            // A company's chosen voice wins; OPENAI_REALTIME_VOICE is only the
            // fleet default for a company that has never picked one.
            voice: company.aiConfiguration?.voice || this.config.openai.realtimeVoice,
          },
        },
        tools: buildRealtimeTools(company.aiConfiguration),
        tool_choice: 'auto',
      },
    };
  }

  /**
   * Execute a tool call emitted by the Realtime model, mutating the live signal
   * store and returning the string result to feed back to the model.
   */
  async executeToolCall(
    companyId: string,
    signals: LiveConversationSignals,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case TOOL.LOOKUP_KNOWLEDGE: {
        const query = String(args.query ?? '').trim();
        const results = await this.rag.retrieve(companyId, query, 4);
        if (results.length === 0) {
          // A knowledge miss used to be a dead end, which wasted the one moment
          // in the call where a visit is easiest to offer. Say what is true,
          // then keep moving.
          return {
            output:
              'Nothing in the knowledge base covers that. Do NOT guess or give a range. ' +
              'Say plainly that you do not have that detail in front of you, offer to have someone ' +
              'confirm it, and keep the conversation moving — this is a good moment to get eyes on ' +
              'the roof' +
              (signals.customer.phone
                ? '. You already have their number, so simply say someone will call them back.'
                : ' and to make sure you have their callback number.'),
          };
        }
        const text = results
          .map((r) => `• ${r.title}: ${r.content}`)
          .join('\n')
          .slice(0, 2000);
        return { output: text };
      }

      case TOOL.CAPTURE_CUSTOMER_INFO: {
        const c = signals.customer;
        if (typeof args.fullName === 'string') c.fullName = args.fullName;
        if (typeof args.phone === 'string') c.phone = args.phone;
        if (typeof args.email === 'string') c.email = args.email;
        if (typeof args.propertyAddress === 'string') c.propertyAddress = args.propertyAddress;
        if (typeof args.propertyType === 'string')
          c.propertyType = normalizeEnum(args.propertyType, PropertyType, PropertyType.UNKNOWN);
        if (typeof args.reason === 'string') c.reason = args.reason;
        if (typeof args.insuranceClaim === 'string') c.insuranceClaim = args.insuranceClaim;
        // Naming what is still outstanding keeps the model from either dropping
        // a required detail or re-asking for one it already has.
        return { output: `Saved. ${describeOutstanding(signals)}` };
      }

      case TOOL.REQUEST_APPOINTMENT: {
        signals.appointment = {
          requested: true,
          serviceRequested: asString(args.serviceRequested),
          preferredDate: asString(args.preferredDate),
          preferredTimeWindow: asString(args.preferredTimeWindow),
          priority: normalizeEnum(args.priority, AppointmentPriority, AppointmentPriority.NORMAL),
          notes: asString(args.notes),
        };
        return {
          output:
            'Appointment request recorded. Tell them the office will confirm the exact window — ' +
            'never state an arrival time yourself. Then ' +
            (signals.customer.phone
              ? 'read the number you already have back digit by digit and check it is the best one ' +
                'for the crew — do not ask them for a number.'
              : 'make sure the callback number is confirmed digit by digit before you wrap up.'),
        };
      }

      case TOOL.FLAG_EMERGENCY: {
        signals.emergency = {
          isEmergency: true,
          urgency: normalizeEnum(args.urgency, UrgencyLevel, UrgencyLevel.EMERGENCY),
          reason: asString(args.reason),
        };
        return {
          output:
            'Emergency flagged and the team is alerted. Reassure the caller in your own words, ' +
            'then get the property address' +
            (signals.customer.phone
              ? ' — a crew cannot be sent to a phone number, and you already have theirs.'
              : ' and confirm the callback number.') +
            ' Skip any other qualifying questions — they can wait, this cannot.',
        };
      }

      case TOOL.TRANSFER_TO_HUMAN: {
        signals.transferRequested = true;
        return { output: 'Transferring the caller to a team member.', transfer: true };
      }

      case TOOL.END_CALL: {
        return { output: 'Ending the call now.', endCall: true };
      }

      default:
        this.logger.warn(`Unknown tool call: ${toolName}`);
        return { output: 'Unable to complete that action.' };
    }
  }

  /**
   * Produce the structured business record for a completed conversation. Uses
   * the Responses API when configured; otherwise falls back to a heuristic
   * result derived from the live signals so the call pipeline still succeeds.
   */
  async analyzeConversation(
    companyId: string,
    transcript: TranscriptEntry[],
    signals: LiveConversationSignals,
  ): Promise<ConversationStructuredOutput> {
    if (!this.openai.isEnabled) {
      return this.fallbackAnalysis(transcript, signals);
    }

    const company = await this.companies.getById(companyId);

    try {
      const analysis = await this.openai.createStructuredResponse<ConversationStructuredOutput>(
        companyId,
        {
          // One prompt, built in one place. Everything the stored record must
          // read like — English policy, transcript rules, roofing vocabulary,
          // summary structure — lives in `normalization.ts`, so there is no
          // second copy here to fall out of step with it.
          instructions: buildAnalysisInstructions(company.name),
          input: renderTranscriptForAnalysis(transcript),
          schemaName: 'conversation_analysis',
          schema: CONVERSATION_OUTPUT_SCHEMA,
        },
      );
      // Null means the adapter declined — the tenant is not active. Fall back to
      // the deterministic path rather than treating it as a model failure.
      if (!analysis) return this.fallbackAnalysis(transcript, signals);
      return this.reconcileTranscript(analysis, transcript);
    } catch (error) {
      this.logger.warn(`Structured analysis failed, using fallback: ${(error as Error).message}`);
      return this.fallbackAnalysis(transcript, signals);
    }
  }

  /**
   * Accept the model's normalized transcript only if it still describes the same
   * conversation.
   *
   * The alignment check lives in `mergeNormalizedTranscript`; this reports what
   * it decided. A rejected transcript is a warning rather than a failure — the
   * structured record and the summary are still good, and the recorded
   * transcript is kept as it was.
   */
  private reconcileTranscript(
    analysis: ConversationStructuredOutput,
    raw: TranscriptEntry[],
  ): ConversationStructuredOutput {
    const { applied, reason } = mergeNormalizedTranscript(raw, analysis.transcript);
    if (!applied && raw.length > 0) {
      this.logger.warn(
        `Normalized transcript rejected (${reason}); keeping the recorded transcript. ` +
          `call had ${raw.length} line(s).`,
      );
      return { ...analysis, transcript: [] };
    }
    const languages = analysis.detectedLanguages ?? [];
    if (languages.some((l) => l && l.toLowerCase() !== 'en')) {
      this.logger.log(`Call transcript normalized to English from: ${languages.join(', ')}.`);
    }
    return analysis;
  }

  /** Deterministic analysis from live signals when the LLM is unavailable. */
  private fallbackAnalysis(
    transcript: TranscriptEntry[],
    signals: LiveConversationSignals,
  ): ConversationStructuredOutput {
    const isEmergency = signals.emergency?.isEmergency ?? false;
    const appointmentRequested = signals.appointment?.requested ?? false;
    const hasContact = Boolean(signals.customer.phone || signals.customer.fullName);

    const outcome = isEmergency
      ? ConversationOutcome.EMERGENCY
      : appointmentRequested
        ? ConversationOutcome.APPOINTMENT_REQUESTED
        : hasContact
          ? ConversationOutcome.LEAD_CAPTURED
          : ConversationOutcome.NO_ACTION;

    const callerLines = transcript.filter((t) => t.role === 'customer').map((t) => t.text);
    const summary = callerLines.length
      ? `Inbound call. Caller said: ${callerLines.join(' ').slice(0, 240)}`
      : 'Inbound call with no transcript captured.';

    return {
      intent: isEmergency
        ? ConversationIntent.EMERGENCY_REPAIR
        : ConversationIntent.GENERAL_QUESTION,
      outcome,
      leadQuality:
        isEmergency || appointmentRequested
          ? LeadQuality.HOT
          : hasContact
            ? LeadQuality.WARM
            : LeadQuality.UNQUALIFIED,
      urgency: isEmergency
        ? UrgencyLevel.EMERGENCY
        : appointmentRequested
          ? UrgencyLevel.MEDIUM
          : UrgencyLevel.LOW,
      customer: {
        fullName: signals.customer.fullName ?? null,
        phone: signals.customer.phone ?? null,
        email: signals.customer.email ?? null,
        propertyAddress: signals.customer.propertyAddress ?? null,
        propertyType: signals.customer.propertyType ?? PropertyType.UNKNOWN,
      },
      serviceType: signals.appointment?.serviceRequested ?? signals.customer.reason ?? null,
      appointment: {
        requested: appointmentRequested,
        serviceRequested: signals.appointment?.serviceRequested ?? null,
        preferredDate: signals.appointment?.preferredDate ?? null,
        preferredTimeWindow: signals.appointment?.preferredTimeWindow ?? null,
        priority: signals.appointment?.priority ?? AppointmentPriority.NORMAL,
        notes: signals.appointment?.notes ?? null,
      },
      emergency: {
        isEmergency,
        urgency: signals.emergency?.urgency ?? UrgencyLevel.LOW,
        reason: signals.emergency?.reason ?? null,
      },
      summary,
      keyPoints: callerLines.slice(0, 4),
      followUpRequired: outcome !== ConversationOutcome.NO_ACTION,
      followUpReason: appointmentRequested ? 'Schedule the requested visit.' : null,
      // Empty rather than a copy of the raw lines. This path runs when no model
      // was available, so nothing has been normalized — and claiming a
      // normalized transcript here would present recogniser output as though it
      // had been through the English policy. The recorded transcript is stored
      // unchanged instead, which is the honest record.
      transcript: [],
      detectedLanguages: [],
    };
  }
}

/**
 * What the office still needs, phrased for the model rather than for a person.
 *
 * Fed back after every capture_customer_info call for two reasons: it stops a
 * required detail being forgotten on a call that wandered, and — because it
 * lists only what is missing — it stops the receptionist asking again for
 * something the caller already gave it, which is the fastest way to sound like
 * a machine.
 */
function describeOutstanding(signals: LiveConversationSignals): string {
  const c = signals.customer;
  const missing: string[] = [];
  if (!c.fullName) missing.push('name');
  if (!c.phone) missing.push('best callback number');
  if (!c.propertyAddress) missing.push('property address');
  if (!c.reason) missing.push('what is wrong with the roof');

  if (missing.length === 0) {
    return 'You have everything the office needs — do not ask for any of it again.';
  }
  return `Still outstanding: ${missing.join(', ')}. Everything else is captured — do not ask for it again.`;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeEnum<T extends Record<string, string>>(
  value: unknown,
  enumObj: T,
  fallback: T[keyof T],
): T[keyof T] {
  const values = Object.values(enumObj);
  return typeof value === 'string' && values.includes(value) ? (value as T[keyof T]) : fallback;
}
