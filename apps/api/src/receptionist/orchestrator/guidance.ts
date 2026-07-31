import { EmpathyLevel, LeadField, type ConversationState, type TurnPlan } from './types';

/**
 * Renders a {@link TurnPlan} into the text handed to the model before its next
 * turn.
 *
 * Written as terse operational notes rather than prose, for two reasons: it is
 * injected on every turn, so length is latency and cost; and a model given a
 * paragraph tends to answer the paragraph, while a model given a single
 * objective and a list of constraints does the thing and stops.
 *
 * It never contains workflow logic. Which question comes next, whether to push
 * on an objection, whether the call may close — all of that is decided in the
 * orchestrator and arrives here already resolved.
 */
export function renderGuidance(
  plan: TurnPlan,
  state: ConversationState,
  corrections: string[] = [],
): string {
  const lines: string[] = ['[CALL CONTEXT — internal, never read aloud or referred to]'];

  lines.push(`Stage: ${plan.stage}`);
  lines.push(`Caller mood: ${state.sentiment}${state.emergency ? ' — EMERGENCY IN PROGRESS' : ''}`);

  const known = plan.alreadyKnown
    .map((field) => `${label(field)}=${state.collected[field] ?? ''}`.trim())
    .filter(Boolean);
  if (known.length > 0) {
    lines.push(`Already known (never ask again): ${known.join('; ')}`);
  }

  lines.push(`YOUR OBJECTIVE THIS TURN: ${plan.objective}`);

  if (plan.clarify) {
    lines.push(
      `This is clarification attempt ${plan.clarify.attempt} of 2 for ${label(plan.clarify.topic)}. ` +
        'Different words than last time. If this one fails, let it go and move on.',
    );
  }

  const empathy = empathyDirective(plan.empathy);
  if (empathy) lines.push(empathy);

  if (plan.useFirstName) {
    lines.push(`Use their first name once, naturally: ${plan.useFirstName}.`);
  }

  lines.push(
    `Keep it to at most ${plan.maxSentences} ${plan.maxSentences === 1 ? 'sentence' : 'sentences'}.`,
  );

  for (const prohibition of plan.prohibitions) lines.push(`Do NOT: ${prohibition}`);
  for (const correction of corrections) lines.push(`Correction: ${correction}`);

  return lines.join('\n');
}

function empathyDirective(level: EmpathyLevel): string | null {
  switch (level) {
    case EmpathyLevel.REASSURE:
      return 'Lead with reassurance — they are worried. Steady, not alarmed.';
    case EmpathyLevel.DE_ESCALATE:
      return 'They are upset. Acknowledge it plainly, own it, do not defend or explain, do not sell.';
    case EmpathyLevel.ACKNOWLEDGE:
      return 'Acknowledge the urgency in one short beat before anything else.';
    case EmpathyLevel.NONE:
      return null;
  }
}

function label(field: LeadField): string {
  return field.toLowerCase().replace(/_/g, ' ');
}
