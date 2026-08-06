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
  END_CALL: 'end_call',
} as const;

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
        'Record customer details as you learn them during the call. Call this the moment a new detail is provided — do not batch them up or wait until the end, because a call that drops early still has to leave the office something usable. Omit fields you do not yet know.',
      parameters: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          propertyAddress: { type: 'string' },
          propertyType: {
            type: 'string',
            enum: Object.values(PropertyType),
            description:
              'RESIDENTIAL for a house or condo, COMMERCIAL for a business, warehouse, HOA, or managed property. Set it as soon as it is clear from what the caller describes — you rarely need to ask outright.',
          },
          reason: {
            type: 'string',
            description:
              "What is actually wrong and how urgent it is, in the office's words: the problem (leak, hail, missing shingles, age, inspection, replacement, second opinion), whether it is active right now, how soon they need someone, and the best time to reach them. This is what the team reads first.",
          },
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
        'Record a request for a visit, estimate, or inspection. Call this as soon as the caller agrees to a visit — do not wait for a firm date. A vague "sometime next week" booked is worth far more to the office than a precise one that was never captured.',
      parameters: {
        type: 'object',
        properties: {
          serviceRequested: { type: 'string' },
          preferredDate: { type: 'string', description: 'ISO date (YYYY-MM-DD) if given.' },
          preferredTimeWindow: {
            type: 'string',
            description:
              'Whatever they gave you, however loose — "morning", "2-4pm", "after work", "early next week". Never leave this empty just because it is imprecise.',
          },
          priority: { type: 'string', enum: Object.values(AppointmentPriority) },
          notes: {
            type: 'string',
            description:
              'Anything the crew or scheduler needs that does not fit elsewhere: access notes, dogs, gate codes, steep or multi-story roof, the caller works nights, a decision maker who is not on the call, a closing date or other deadline.',
          },
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
        'Flag the call as an emergency (active leak, storm damage, water intrusion, or safety issue) so the team is alerted immediately. Call this as soon as you recognize it, before finishing any other questions — the alert is more useful thirty seconds earlier than it is complete.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description:
              'What is happening right now, concretely — "water coming through the kitchen ceiling during a storm", "tree limb through the roof over a bedroom". Include anything about safety or people in the affected room.',
          },
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
      description:
        'Transfer the caller to a human team member. Use it when they ask for a person, when they are angry enough that a person will do better than you will, or when you have failed twice to understand something that matters — an offered transfer keeps a caller who would otherwise hang up.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    });
  }

  tools.push({
    type: 'function',
    name: TOOL.END_CALL,
    description:
      'Hang up the call. Call this ONLY after you have said your full goodbye and the caller has confirmed there is nothing else they need.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  });

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
    // The normalized transcript rides on the same structured response as the
    // summary. One pass, one view of the conversation: a separate cleanup call
    // would cost a second round trip and could disagree with the summary about
    // what was said.
    transcript: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          role: { type: 'string', enum: ['assistant', 'customer'] },
          text: { type: 'string' },
          originalText: { type: ['string', 'null'] },
          lowConfidence: { type: 'boolean' },
        },
        required: ['role', 'text', 'originalText', 'lowConfidence'],
      },
    },
    detectedLanguages: { type: 'array', items: { type: 'string' } },
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
    'transcript',
    'detectedLanguages',
  ],
};
