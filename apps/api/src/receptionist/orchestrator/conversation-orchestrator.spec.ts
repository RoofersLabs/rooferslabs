import { ConversationOrchestrator } from './conversation-orchestrator';
import { TOOL } from '../tools';
import {
  AppointmentProgress,
  CallDisposition,
  ConversationStage,
  EmpathyLevel,
  LeadField,
  ObjectionType,
  Sentiment,
} from './types';

/** Capture a name the way a real call does — through a tool call. */
function withName(o: ConversationOrchestrator, name = 'John Alvarez'): void {
  o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { fullName: name });
}

describe('mandatory name collection', () => {
  it('makes the name the highest-priority missing field once the problem is known', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('My roof has been leaking since the storm last night.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Leak after storm' });

    const { plan } = o.nextTurn();
    expect(plan.targetField).toBe(LeadField.NAME);
    expect(plan.stage).toBe(ConversationStage.NAME_COLLECTION);
  });

  it('never asks for the name twice once it is captured', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('I need someone to look at my roof.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Roof inspection' });
    withName(o);

    const { plan } = o.nextTurn();
    expect(plan.targetField).not.toBe(LeadField.NAME);
    expect(plan.alreadyKnown).toContain(LeadField.NAME);
  });

  it('blocks closing until the name exists on a homeowner call', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Roof is old, want a quote.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      reason: 'Old roof, wants a quote',
      phone: '512-555-0134',
      propertyAddress: '18 Balcones Dr, Austin TX',
    });

    expect(o.snapshot().stage).not.toBe(ConversationStage.CLOSING);
    expect(o.missingFields()).toContain(LeadField.NAME);
  });

  it('exempts calls that are not leads from the name requirement', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Sorry, wrong number.');

    const { plan } = o.nextTurn();
    expect(o.snapshot().disposition).toBe(CallDisposition.WRONG_NUMBER);
    expect(plan.stage).toBe(ConversationStage.CLOSING);
    expect(plan.targetField).toBeNull();
  });

  it('uses the first name periodically but not on every turn', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Hi, my roof is leaking.');
    withName(o, 'Sarah Chen');

    const first = o.nextTurn().plan.useFirstName;
    o.observeAssistantTurn('Thanks, Sarah. Where is the property?');
    const second = o.nextTurn().plan.useFirstName;

    expect(first).toBe('Sarah');
    // Alternating keeps it punctuation rather than a sales tic.
    expect(second).toBeNull();
  });
});

describe('emergency prioritization', () => {
  it('asks for the address before anything else, including the name', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Water is pouring through my ceiling right now!');
    o.observeToolCall(TOOL.FLAG_EMERGENCY, { reason: 'Water pouring through the ceiling' });

    const { plan } = o.nextTurn();
    expect(plan.targetField).toBe(LeadField.ADDRESS);
    expect(plan.empathy).toBe(EmpathyLevel.REASSURE);
    expect(plan.prohibitions.join(' ')).toContain('property type');
  });

  it('still requires the name later in the call', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Water is coming in through the ceiling!');
    o.observeToolCall(TOOL.FLAG_EMERGENCY, { reason: 'Active leak' });
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      propertyAddress: '4 Oak St, Austin TX',
      phone: '5125550134',
    });

    expect(o.missingFields()).toContain(LeadField.NAME);
    expect(o.nextTurn().plan.targetField).toBe(LeadField.NAME);
  });

  it('reads panic from the caller and reassures', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn("The ceiling is caving in, water everywhere, I don't know what to do!");
    expect(o.snapshot().sentiment).toBe(Sentiment.PANIC);
    expect(o.nextTurn().plan.empathy).toBe(EmpathyLevel.REASSURE);
  });
});

describe('objections and booking pressure', () => {
  it('records an objection and forbids raising it again', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn("I'm just looking, honestly. I only wanted a ballpark.");

    expect(o.snapshot().objections).toContain(ObjectionType.JUST_LOOKING);
    expect(o.nextTurn().plan.prohibitions.join(' ')).toContain('already pushed back');
  });

  it('never offers a visit again once one is declined', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('My roof needs looking at.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      reason: 'Worn roof',
      fullName: 'Dana Reed',
      phone: '5125550134',
    });
    o.observeCallerTurn("No thanks, I don't want an appointment.");

    expect(o.snapshot().appointment).toBe(AppointmentProgress.DECLINED);
    const { plan } = o.nextTurn();
    expect(plan.targetField).not.toBe(LeadField.APPOINTMENT);
    expect(plan.prohibitions.join(' ')).toContain('declined a visit');
  });

  it('does not pitch a visit to an angry caller', () => {
    const o = new ConversationOrchestrator();
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      reason: 'Crew never showed up',
      fullName: 'Pat Doyle',
      phone: '5125550134',
    });
    o.observeCallerTurn('This is unacceptable, nobody ever called me back!');

    const { plan } = o.nextTurn();
    expect(o.snapshot().sentiment).toBe(Sentiment.ANGER);
    expect(plan.targetField).not.toBe(LeadField.APPOINTMENT);
    expect(plan.empathy).toBe(EmpathyLevel.DE_ESCALATE);
  });
});

describe('clarification and escalation', () => {
  it('caps clarification at two attempts and rephrases each time', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('My roof is leaking badly.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Leak' });
    o.nextTurn(); // targets NAME

    o.observeCallerTurn('uh um uh');
    const first = o.nextTurn().plan;
    expect(first.clarify?.attempt).toBe(1);
    expect(first.prohibitions.join(' ')).toContain('previous wording');

    o.observeCallerTurn('um uh mm');
    expect(o.nextTurn().plan.clarify?.attempt).toBe(2);

    // Third failure: stop asking. The field is let go rather than looped on.
    o.observeCallerTurn('uh um');
    expect(o.nextTurn().plan.clarify).toBeNull();
  });

  it('escalates when the caller asks for a person', () => {
    const o = new ConversationOrchestrator(true);
    o.observeCallerTurn('Can I just speak to a real person please?');

    expect(o.snapshot().escalation.requestedByCaller).toBe(true);
    const { plan } = o.nextTurn();
    expect(plan.expectedTool).toBe(TOOL.TRANSFER_TO_HUMAN);
    expect(plan.empathy).toBe(EmpathyLevel.DE_ESCALATE);
  });

  it('does not recommend escalation when there is nobody to transfer to', () => {
    const o = new ConversationOrchestrator(false);
    o.observeCallerTurn('This is ridiculous, absolutely unacceptable.');
    expect(o.snapshot().escalation.recommended).toBe(false);
  });
});

describe('memory and interruption', () => {
  it('never loses a captured value to a later partial tool call', () => {
    const o = new ConversationOrchestrator();
    withName(o, 'Miguel Santos');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { phone: '5125550134' });

    expect(o.snapshot().collected[LeadField.NAME]).toBe('Miguel Santos');
  });

  it('derives city, storm, and leak signals from what was captured', () => {
    const o = new ConversationOrchestrator();
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      propertyAddress: '18 Balcones Dr, Austin TX 78731',
      reason: 'Hail damage from the storm, and a leak over the kitchen',
    });

    const collected = o.snapshot().collected;
    expect(collected[LeadField.CITY]).toBe('Austin');
    expect(collected[LeadField.STORM_DAMAGE]).toBe('yes');
    expect(collected[LeadField.ACTIVE_LEAK]).toBe('yes');
  });

  it('remembers the interrupted topic so the turn can resume', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Roof is leaking.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Leak' });
    const { plan } = o.nextTurn();

    o.observeInterruption();
    expect(o.snapshot().interrupted).toBe(true);
    expect(o.snapshot().pendingTopic).toBe(plan.targetField);
  });

  it('reports completeness so the office can see partial leads', () => {
    const o = new ConversationOrchestrator();
    expect(o.completenessScore()).toBe(0);
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, {
      fullName: 'Ada Byron',
      phone: '5125550134',
      reason: 'Missing shingles',
    });
    expect(o.completenessScore()).toBeGreaterThan(0);
  });
});

describe('guidance rendering', () => {
  it('states the objective and the known fields without leaking workflow', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('My roof is leaking after the hail.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Hail damage', fullName: 'Ann Lee' });

    const { guidance } = o.nextTurn();
    expect(guidance).toContain('YOUR OBJECTIVE THIS TURN');
    expect(guidance).toContain('Already known (never ask again)');
    expect(guidance).toContain('internal, never read aloud');
  });

  it('carries quality corrections into the next turn', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('Roof leak.');
    o.observeToolCall(TOOL.CAPTURE_CUSTOMER_INFO, { reason: 'Leak', fullName: 'Ann Lee' });
    o.nextTurn();

    // A turn that asks for something already known must be corrected, not repeated.
    o.observeAssistantTurn('Sure — and may I have your name so I know who I am speaking with?');
    expect(o.latestFindings().map((f) => f.code)).toContain('ASKED_KNOWN_FIELD');
    expect(o.nextTurn().guidance).toContain('Correction:');
  });
});

describe('sentiment edge cases', () => {
  it('does not read a refusal as urgency', () => {
    // "right now" is urgency vocabulary, but negated it means the opposite —
    // and reading it as urgency makes the receptionist press the one caller who
    // just asked it not to.
    const o = new ConversationOrchestrator();
    o.observeCallerTurn("No thanks, I don't want an appointment right now.");
    expect(o.snapshot().sentiment).not.toBe(Sentiment.URGENCY);
    expect(o.snapshot().appointment).toBe(AppointmentProgress.DECLINED);
  });

  it('still reads genuine urgency', () => {
    const o = new ConversationOrchestrator();
    o.observeCallerTurn('I need somebody out here today if at all possible.');
    expect(o.snapshot().sentiment).toBe(Sentiment.URGENCY);
  });
});
