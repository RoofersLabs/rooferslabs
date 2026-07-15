/**
 * AI structured-output contracts.
 *
 * These types describe the structured data extracted from a completed AI
 * conversation via the OpenAI Responses API (see
 * `docs/07_AI_Receptionist_Specification.md`). They are produced by the backend
 * AI module and consumed by both the persistence layer and the frontend.
 */
import type {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
} from './enums';

/** Customer identity/contact details extracted from the conversation. */
export interface ExtractedCustomer {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  propertyAddress: string | null;
  propertyType: PropertyType;
}

/** An appointment request captured during the conversation. */
export interface ExtractedAppointmentRequest {
  requested: boolean;
  serviceRequested: string | null;
  preferredDate: string | null; // ISO 8601 date (YYYY-MM-DD) or null
  preferredTimeWindow: string | null; // e.g. "morning", "2-4pm"
  priority: AppointmentPriority;
  notes: string | null;
}

/** Emergency assessment for the conversation. */
export interface EmergencyAssessment {
  isEmergency: boolean;
  urgency: UrgencyLevel;
  reason: string | null;
}

/**
 * The complete structured output produced for a conversation. This is the exact
 * shape the Responses API is instructed to return (JSON schema constrained).
 */
export interface ConversationStructuredOutput {
  intent: ConversationIntent;
  outcome: ConversationOutcome;
  leadQuality: LeadQuality;
  urgency: UrgencyLevel;
  customer: ExtractedCustomer;
  serviceType: string | null;
  appointment: ExtractedAppointmentRequest;
  emergency: EmergencyAssessment;
  summary: string;
  keyPoints: string[];
  followUpRequired: boolean;
  followUpReason: string | null;
}

/** A single line of a rendered conversation transcript. */
export interface TranscriptEntry {
  role: 'assistant' | 'customer';
  text: string;
  /** Milliseconds from the start of the conversation. */
  offsetMs: number;
}

/** A knowledge-base chunk returned by RAG retrieval for AI grounding. */
export interface RetrievedKnowledge {
  articleId: string;
  title: string;
  category: string;
  content: string;
  score: number;
}
