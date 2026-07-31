/**
 * Conversation orchestration.
 *
 * The application layer that owns conversation intelligence: state, stage,
 * priorities, sentiment, clarification, escalation, and quality. The model is
 * given one objective at a time and writes the words; it is never asked to
 * remember what has been collected or to decide what happens next.
 *
 * See docs/conversation-orchestration.md for the architecture and for what the
 * Realtime transport does and does not allow this layer to enforce.
 */
export { ConversationOrchestrator } from './conversation-orchestrator';
export { ClarificationManager, MAX_CLARIFICATION_ATTEMPTS } from './clarification';
export { EscalationPolicy } from './escalation';
export { LeadCompletenessTracker } from './lead-completeness';
export { QualityValidator } from './quality-validator';
export { QuestionPrioritizer } from './question-prioritizer';
export { ResponsePlanner } from './response-planner';
export { SentimentAnalyzer } from './sentiment';
export { StageTransitionEngine } from './stage-engine';
export { renderGuidance } from './guidance';
export {
  AppointmentProgress,
  CallDisposition,
  ConversationStage,
  EmpathyLevel,
  LeadField,
  ObjectionType,
  Sentiment,
  type ClarificationState,
  type ConversationState,
  type EscalationState,
  type QualityFinding,
  type TurnPlan,
} from './types';
