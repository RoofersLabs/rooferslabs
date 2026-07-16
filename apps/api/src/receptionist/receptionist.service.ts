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
import { buildRealtimeTools, CONVERSATION_OUTPUT_SCHEMA, TOOL } from './tools';
import { type LiveConversationSignals, type ToolExecutionResult } from './session-state';

export interface RealtimeSessionConfig {
  model: string;
  voice: string;
  instructions: string;
  greeting: string;
  tools: ReturnType<typeof buildRealtimeTools>;
}

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

  /** Build the OpenAI Realtime session configuration for a company. */
  async buildSessionConfig(companyId: string): Promise<RealtimeSessionConfig> {
    const company = await this.companies.getById(companyId);
    return {
      model: this.config.openai.realtimeModel,
      voice: company.aiConfiguration?.voice || 'alloy',
      instructions: buildReceptionistInstructions(company),
      greeting: buildGreeting(company),
      tools: buildRealtimeTools(company.aiConfiguration),
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
          return {
            output: 'No specific information is available. Offer to have the team follow up.',
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
        return { output: 'Customer details recorded.' };
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
          output: 'Appointment request recorded. Confirm the team will follow up to schedule.',
        };
      }

      case TOOL.FLAG_EMERGENCY: {
        signals.emergency = {
          isEmergency: true,
          urgency: normalizeEnum(args.urgency, UrgencyLevel, UrgencyLevel.EMERGENCY),
          reason: asString(args.reason),
        };
        return {
          output: 'Emergency flagged. Reassure the caller and collect the property address.',
        };
      }

      case TOOL.TRANSFER_TO_HUMAN: {
        signals.transferRequested = true;
        return { output: 'Transferring the caller to a team member.', transfer: true };
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
    const conversationText = transcript
      .map((entry) => `${entry.role === 'assistant' ? 'AI' : 'Caller'}: ${entry.text}`)
      .join('\n');

    const instructions =
      `You analyze a phone call transcript for ${company.name}, a roofing company, and extract a structured business record. ` +
      `Base every field strictly on the transcript. Use null for unknown values. Write a concise, factual summary (2-3 sentences) from the roofing company's perspective.`;

    try {
      return await this.openai.createStructuredResponse<ConversationStructuredOutput>({
        instructions,
        input: conversationText || 'No conversation content was recorded.',
        schemaName: 'conversation_analysis',
        schema: CONVERSATION_OUTPUT_SCHEMA,
      });
    } catch (error) {
      this.logger.warn(`Structured analysis failed, using fallback: ${(error as Error).message}`);
      return this.fallbackAnalysis(transcript, signals);
    }
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
    };
  }
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
