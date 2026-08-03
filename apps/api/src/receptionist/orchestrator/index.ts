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

/**
 * Deliberately one export.
 *
 * The collaborators behind it — the stage engine, the prioritizer, the
 * sentiment analyzer and the rest — are implementation detail, and siblings
 * import each other directly. Re-exporting them here would publish a surface
 * nothing consumes and invite a caller to reach past the orchestrator into the
 * middle of a conversation's state machine.
 */
