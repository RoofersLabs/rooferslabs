/**
 * AI structured-output contracts.
 *
 * These types describe the structured data extracted from a completed AI
 * conversation via the OpenAI Responses API. They are produced by the backend
 * AI module and consumed by both the persistence layer and the frontend.
 */
import type {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
} from './enums.js';

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
  /**
   * The office-manager summary: professional English, organised into the
   * sections that are actually relevant to this call.
   */
  summary: string;
  keyPoints: string[];
  followUpRequired: boolean;
  followUpReason: string | null;
  /**
   * The conversation rewritten into clean, professional English — correct
   * spelling, punctuation, grammar and roofing terminology, with streaming
   * artifacts and duplicated filler removed.
   *
   * Meaning is preserved exactly; nothing is invented. A segment the model could
   * not confidently interpret keeps its original wording and is flagged rather
   * than guessed at, which is why `text` is not simply trusted as a translation.
   */
  transcript: NormalizedTranscriptEntry[];
  /**
   * The languages actually heard, as BCP-47-ish tags ("en", "es", "hi"). Empty
   * or `['en']` for an ordinary English call. Stored so an office can tell at a
   * glance that a record was translated rather than transcribed.
   */
  detectedLanguages: string[];
}

/** One line of the normalized transcript the analysis pass produces. */
export interface NormalizedTranscriptEntry {
  role: 'assistant' | 'customer';
  /** The line in clean professional English. */
  text: string;
  /**
   * The recognizer's original wording, kept whenever it differs — so the
   * normalization can always be audited against what was actually heard.
   */
  originalText: string | null;
  /**
   * True when the model could not confidently interpret or translate this line.
   * `text` then holds the original wording verbatim rather than a guess.
   */
  lowConfidence: boolean;
}

/**
 * A single line of a rendered conversation transcript.
 *
 * Written live by the media-stream bridge as the recognizer produces it, then
 * replaced in place by the normalized text once post-call analysis runs. The two
 * optional fields are what make that replacement auditable rather than lossy:
 * `originalText` is what was heard, `lowConfidence` marks a line the model
 * declined to rewrite.
 */
export interface TranscriptEntry {
  role: 'assistant' | 'customer';
  text: string;
  /** Milliseconds from the start of the conversation. */
  offsetMs: number;
  /** Present only when normalization changed the line. */
  originalText?: string | null;
  /** Present only when normalization was not confident enough to rewrite. */
  lowConfidence?: boolean;
}

/** A knowledge-base chunk returned by RAG retrieval for AI grounding. */
export interface RetrievedKnowledge {
  articleId: string;
  title: string;
  category: string;
  content: string;
  score: number;
}
