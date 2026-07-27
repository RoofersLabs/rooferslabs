import {
  ConversationIntent,
  ConversationOutcome,
  ConversationStatus,
  LeadQuality,
  UrgencyLevel,
} from '@rooferslabs/shared';
import { derivePriorityLeads, type PriorityLead } from './insights';
import type { Conversation } from '@/types/api';

/**
 * The mobile dashboard leads with these cards, so the rules that decide which
 * calls appear — and in what order — are asserted rather than eyeballed. A
 * missed emergency here is the worst failure this product can have.
 */
function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    companyId: 'co1',
    callId: 'call1',
    status: ConversationStatus.COMPLETED,
    outcome: ConversationOutcome.LEAD_CAPTURED,
    intent: ConversationIntent.NEW_ESTIMATE,
    leadQuality: LeadQuality.WARM,
    urgency: UrgencyLevel.MEDIUM,
    isEmergency: false,
    transcript: null,
    summary: 'Wants an estimate for a leaking roof.',
    keyPoints: [],
    customer: {
      id: 'cust1',
      fullName: 'Dana Reyes',
      phone: '+15551234567',
      propertyAddress: '12 Oak Street, Austin, TX',
    },
    call: { id: 'call1', durationSeconds: 120, fromNumber: '+15559876543', createdAt: '' },
    createdAt: '2026-07-27T12:00:00.000Z',
    ...overrides,
  } as Conversation;
}

/**
 * The single lead these cases expect, asserted rather than indexed —
 * `noUncheckedIndexedAccess` makes `[0]` optional, and a silent `undefined`
 * would turn a dropped lead into a passing test.
 */
function onlyLead(conversations: Conversation[]): PriorityLead {
  const leads = derivePriorityLeads(conversations);
  if (leads.length !== 1) {
    throw new Error(`expected exactly one lead, got ${leads.length}`);
  }
  return leads[0]!;
}

describe('derivePriorityLeads', () => {
  describe('which calls qualify', () => {
    it('keeps a captured lead', () => {
      expect(derivePriorityLeads([conversation()])).toHaveLength(1);
    });

    it('drops spam even when the AI rated it a hot lead', () => {
      const spam = conversation({
        outcome: ConversationOutcome.SPAM,
        leadQuality: LeadQuality.HOT,
      });
      expect(derivePriorityLeads([spam])).toHaveLength(0);
    });

    it('drops an informational call that produced no lead', () => {
      const info = conversation({
        outcome: ConversationOutcome.INFORMATION_PROVIDED,
        leadQuality: LeadQuality.UNQUALIFIED,
        isEmergency: false,
      });
      expect(derivePriorityLeads([info])).toHaveLength(0);
    });

    it('keeps an emergency regardless of its outcome or quality', () => {
      const emergency = conversation({
        outcome: ConversationOutcome.NO_ACTION,
        leadQuality: LeadQuality.UNQUALIFIED,
        isEmergency: true,
      });
      expect(derivePriorityLeads([emergency])).toHaveLength(1);
    });

    it.each([
      ['APPOINTMENT_REQUESTED', ConversationOutcome.APPOINTMENT_REQUESTED],
      ['EMERGENCY', ConversationOutcome.EMERGENCY],
    ])('keeps a %s outcome', (_label, outcome) => {
      expect(derivePriorityLeads([conversation({ outcome })])).toHaveLength(1);
    });
  });

  describe('priority', () => {
    it('reports Emergency for a flagged emergency', () => {
      expect(onlyLead([conversation({ isEmergency: true })]).priority).toBe('Emergency');
    });

    it('reports Emergency for EMERGENCY urgency even when the flag is unset', () => {
      const c = conversation({ isEmergency: false, urgency: UrgencyLevel.EMERGENCY });
      expect(onlyLead([c]).priority).toBe('Emergency');
    });

    it.each([
      ['HIGH urgency', { urgency: UrgencyLevel.HIGH }],
      ['a HOT lead', { leadQuality: LeadQuality.HOT }],
    ])('reports High for %s', (_label, overrides) => {
      expect(onlyLead([conversation(overrides)]).priority).toBe('High');
    });

    it.each([[UrgencyLevel.LOW], [UrgencyLevel.MEDIUM]])(
      'collapses %s urgency to Medium',
      (urgency) => {
        const c = conversation({ urgency, leadQuality: LeadQuality.WARM });
        expect(onlyLead([c]).priority).toBe('Medium');
      },
    );
  });

  describe('ordering', () => {
    it('puts an older emergency above a newer routine lead', () => {
      const older = conversation({
        id: 'emergency',
        isEmergency: true,
        createdAt: '2026-07-27T08:00:00.000Z',
      });
      const newer = conversation({
        id: 'routine',
        urgency: UrgencyLevel.MEDIUM,
        createdAt: '2026-07-27T11:00:00.000Z',
      });

      expect(derivePriorityLeads([newer, older]).map((l) => l.id)).toEqual([
        'emergency',
        'routine',
      ]);
    });

    it('falls back to newest-first within one priority', () => {
      const old = conversation({ id: 'old', createdAt: '2026-07-27T08:00:00.000Z' });
      const recent = conversation({ id: 'recent', createdAt: '2026-07-27T11:00:00.000Z' });

      expect(derivePriorityLeads([old, recent]).map((l) => l.id)).toEqual(['recent', 'old']);
    });

    it('does not reorder the caller’s array', () => {
      const input = [
        conversation({ id: 'a', createdAt: '2026-07-27T08:00:00.000Z' }),
        conversation({ id: 'b', isEmergency: true, createdAt: '2026-07-27T07:00:00.000Z' }),
      ];
      derivePriorityLeads(input);
      expect(input.map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('honours the limit', () => {
      const many = Array.from({ length: 8 }, (_, i) => conversation({ id: `c${i}` }));
      expect(derivePriorityLeads(many, 3)).toHaveLength(3);
    });
  });

  describe('card fields', () => {
    it('maps name, address, summary and phone straight through', () => {
      expect(onlyLead([conversation()])).toMatchObject({
        name: 'Dana Reyes',
        address: '12 Oak Street, Austin, TX',
        summary: 'Wants an estimate for a leaking roof.',
        phone: '+15551234567',
      });
    });

    it('falls back to the calling number when the caller gave no name', () => {
      const anonymous = conversation({
        customer: { id: 'cust1', fullName: null, phone: null },
      });
      const lead = onlyLead([anonymous]);
      // Formatted for display, unlike `phone`, which has to stay dialable.
      expect(lead.name).toBe('(555) 987-6543');
      expect(lead.phone).toBe('+15559876543');
    });

    it('reports a missing address as null rather than blank text', () => {
      const noAddress = conversation({
        customer: { id: 'cust1', fullName: 'Dana Reyes', phone: '+15551234567' },
      });
      expect(onlyLead([noAddress]).address).toBeNull();
    });

    it('treats a whitespace-only address and summary as missing', () => {
      const blank = conversation({
        summary: '   ',
        customer: {
          id: 'cust1',
          fullName: 'Dana Reyes',
          phone: '+15551234567',
          propertyAddress: '  ',
        },
      });
      const lead = onlyLead([blank]);
      expect(lead.address).toBeNull();
      expect(lead.summary).toBeNull();
    });

    it('has no phone to dial when neither the customer nor the call carries one', () => {
      const unreachable = conversation({
        customer: { id: 'cust1', fullName: 'Dana Reyes', phone: null },
        call: { id: 'call1', durationSeconds: null, fromNumber: null, createdAt: '' },
      });
      expect(onlyLead([unreachable]).phone).toBeNull();
    });
  });
});
