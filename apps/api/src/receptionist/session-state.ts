import type { AppointmentPriority, PropertyType, UrgencyLevel } from '@rooferslabs/shared';

/**
 * Signals accumulated from the AI's tool calls during a live call. The
 * telephony bridge (M6) owns one of these per active session and persists them,
 * together with the transcript, when the call ends (M7 call pipeline).
 */
export interface LiveConversationSignals {
  customer: {
    fullName?: string;
    phone?: string;
    email?: string;
    propertyAddress?: string;
    propertyType?: PropertyType;
    reason?: string;
    /** 'yes' | 'no' | 'unsure' — insurance claim status when it comes up. */
    insuranceClaim?: string;
  };
  appointment?: {
    requested: boolean;
    serviceRequested?: string;
    preferredDate?: string;
    preferredTimeWindow?: string;
    priority?: AppointmentPriority;
    notes?: string;
  };
  emergency?: {
    isEmergency: boolean;
    urgency?: UrgencyLevel;
    reason?: string;
  };
  transferRequested: boolean;
}

export function createEmptySignals(): LiveConversationSignals {
  return { customer: {}, transferRequested: false };
}

/** The result of executing a tool call, returned to the Realtime model. */
export interface ToolExecutionResult {
  output: string;
  /** Set when the tool requests a human transfer, so the bridge can act. */
  transfer?: boolean;
}
