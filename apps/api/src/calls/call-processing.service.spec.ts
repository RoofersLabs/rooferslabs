import {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
  type ConversationStructuredOutput,
} from '@rooferslabs/shared';
import { buildLeadSummaryMessage } from './call-processing.service';
import { createEmptySignals } from '../receptionist/session-state';

function makeStructured(
  overrides: Partial<ConversationStructuredOutput> = {},
): ConversationStructuredOutput {
  return {
    intent: ConversationIntent.EMERGENCY_REPAIR,
    outcome: ConversationOutcome.EMERGENCY,
    leadQuality: LeadQuality.HOT,
    urgency: UrgencyLevel.HIGH,
    customer: {
      fullName: 'Jagadeesh',
      phone: '+917095139509',
      email: null,
      propertyAddress: '4-37, Opposite State Bank ATM, Dhalaprolu, Vijayawada',
      propertyType: PropertyType.RESIDENTIAL,
    },
    serviceType: 'Roof Leak',
    appointment: {
      requested: true,
      serviceRequested: 'Emergency leak repair',
      preferredDate: null,
      preferredTimeWindow: 'Next 2 days',
      priority: AppointmentPriority.EMERGENCY,
      notes: null,
    },
    emergency: { isEmergency: true, urgency: UrgencyLevel.EMERGENCY, reason: 'Active leak' },
    summary: 'Caller reported an active roof leak.',
    keyPoints: [],
    followUpRequired: true,
    followUpReason: null,
    ...overrides,
  };
}

describe('buildLeadSummaryMessage', () => {
  it('produces an actionable multi-line lead summary', () => {
    const signals = createEmptySignals();
    signals.customer.insuranceClaim = 'unsure';

    const message = buildLeadSummaryMessage(makeStructured(), signals);

    expect(message).toContain('Customer: Jagadeesh');
    expect(message).toContain('Phone: +917095139509');
    expect(message).toContain('Problem: Roof Leak');
    expect(message).toContain('Priority: High');
    expect(message).toContain('Requested visit: Next 2 days');
    expect(message).toContain('Insurance: Unsure');
    expect(message).toContain('Location: 4-37, Opposite State Bank ATM, Dhalaprolu, Vijayawada');
  });

  it('omits empty lines and defaults insurance to Unknown', () => {
    const message = buildLeadSummaryMessage(
      makeStructured({
        customer: {
          fullName: null,
          phone: null,
          email: null,
          propertyAddress: null,
          propertyType: PropertyType.UNKNOWN,
        },
        serviceType: null,
        appointment: {
          requested: false,
          serviceRequested: null,
          preferredDate: null,
          preferredTimeWindow: null,
          priority: AppointmentPriority.NORMAL,
          notes: null,
        },
      }),
    );

    expect(message).toContain('Customer: Unknown');
    expect(message).toContain('Insurance: Unknown');
    expect(message).not.toContain('Phone:');
    expect(message).not.toContain('Problem:');
    expect(message).not.toContain('Requested visit:');
    expect(message).not.toContain('Location:');
  });

  it('falls back to team scheduling text when a visit is requested without a time', () => {
    const message = buildLeadSummaryMessage(
      makeStructured({
        appointment: {
          requested: true,
          serviceRequested: 'Inspection',
          preferredDate: null,
          preferredTimeWindow: null,
          priority: AppointmentPriority.NORMAL,
          notes: null,
        },
      }),
    );

    expect(message).toContain('Requested visit: Team to schedule');
  });
});
