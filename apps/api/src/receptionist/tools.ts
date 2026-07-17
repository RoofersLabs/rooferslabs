import type { AiConfiguration } from '@prisma/client';
import {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
} from '@rooferslabs/shared';

/** Names of the function tools the AI receptionist can call during a call. */
export const TOOL = {
  LOOKUP_KNOWLEDGE: 'lookup_knowledge',
  CAPTURE_CUSTOMER_INFO: 'capture_customer_info',
  REQUEST_APPOINTMENT: 'request_appointment',
  FLAG_EMERGENCY: 'flag_emergency',
  TRANSFER_TO_HUMAN: 'transfer_to_human',
} as const;

export type ToolName = (typeof TOOL)[keyof typeof TOOL];

interface RealtimeTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Build the Realtime function-tool set enabled for a company's AI config. */
export function buildRealtimeTools(config: AiConfiguration | null): RealtimeTool[] {
  const tools: RealtimeTool[] = [
    {
      type: 'function',
      name: TOOL.LOOKUP_KNOWLEDGE,
      description:
        'Search the company knowledge base to answer a caller question about services, pricing, warranty, financing, policies, or business details. Always use this before answering company-specific questions.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The caller’s question or topic to look up.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: TOOL.CAPTURE_CUSTOMER_INFO,
      description:
        'Record customer details as you learn them during the call. Call this whenever a new detail is provided; omit fields you do not yet know.',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          propertyAddress: { type: 'string' },
          propertyType: { type: 'string', enum: Object.values(PropertyType) },
          reason: { type: 'string', description: 'Why the customer is calling.' },
          insuranceClaim: {
            type: 'string',
            enum: ['yes', 'no', 'unsure'],
            description:
              'Whether the customer has (or plans) an insurance claim for this work, if it comes up.',
          },
        },
        additionalProperties: false,
      },
    },
  ];

  if (config?.requestAppointments !== false) {
    tools.push({
      type: 'function',
      name: TOOL.REQUEST_APPOINTMENT,
      description:
        'Record a request for a visit, estimate, or inspection, including the preferred day and time window.',
      parameters: {
        type: 'object',
        properties: {
          serviceRequested: { type: 'string' },
          preferredDate: { type: 'string', description: 'ISO date (YYYY-MM-DD) if given.' },
          preferredTimeWindow: { type: 'string', description: 'e.g. "morning", "2-4pm".' },
          priority: { type: 'string', enum: Object.values(AppointmentPriority) },
          notes: { type: 'string' },
        },
        additionalProperties: false,
      },
    });
  }

  if (config?.detectEmergencies !== false) {
    tools.push({
      type: 'function',
      name: TOOL.FLAG_EMERGENCY,
      description:
        'Flag the call as an emergency (active leak, storm damage, water intrusion, or safety issue) so the team is alerted immediately.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
          urgency: { type: 'string', enum: Object.values(UrgencyLevel) },
        },
        required: ['reason'],
        additionalProperties: false,
      },
    });
  }

  if (config?.transferToHuman && config.transferPhone) {
    tools.push({
      type: 'function',
      name: TOOL.TRANSFER_TO_HUMAN,
      description: 'Transfer the caller to a human team member when they explicitly request it.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    });
  }

  return tools;
}

/**
 * Strict JSON schema (OpenAI Responses API) for post-call structured extraction.
 * Produces a {@link ConversationStructuredOutput}. Strict mode requires every
 * property listed in `required` and `additionalProperties: false`.
 */
export const CONVERSATION_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: Object.values(ConversationIntent) },
    outcome: { type: 'string', enum: Object.values(ConversationOutcome) },
    leadQuality: { type: 'string', enum: Object.values(LeadQuality) },
    urgency: { type: 'string', enum: Object.values(UrgencyLevel) },
    customer: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fullName: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        propertyAddress: { type: ['string', 'null'] },
        propertyType: { type: 'string', enum: Object.values(PropertyType) },
      },
      required: ['fullName', 'phone', 'email', 'propertyAddress', 'propertyType'],
    },
    serviceType: { type: ['string', 'null'] },
    appointment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requested: { type: 'boolean' },
        serviceRequested: { type: ['string', 'null'] },
        preferredDate: { type: ['string', 'null'] },
        preferredTimeWindow: { type: ['string', 'null'] },
        priority: { type: 'string', enum: Object.values(AppointmentPriority) },
        notes: { type: ['string', 'null'] },
      },
      required: [
        'requested',
        'serviceRequested',
        'preferredDate',
        'preferredTimeWindow',
        'priority',
        'notes',
      ],
    },
    emergency: {
      type: 'object',
      additionalProperties: false,
      properties: {
        isEmergency: { type: 'boolean' },
        urgency: { type: 'string', enum: Object.values(UrgencyLevel) },
        reason: { type: ['string', 'null'] },
      },
      required: ['isEmergency', 'urgency', 'reason'],
    },
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    followUpRequired: { type: 'boolean' },
    followUpReason: { type: ['string', 'null'] },
  },
  required: [
    'intent',
    'outcome',
    'leadQuality',
    'urgency',
    'customer',
    'serviceType',
    'appointment',
    'emergency',
    'summary',
    'keyPoints',
    'followUpRequired',
    'followUpReason',
  ],
};
