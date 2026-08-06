import {
  AppointmentPriority,
  ConversationIntent,
  ConversationOutcome,
  LeadQuality,
  PropertyType,
  UrgencyLevel,
  type ConversationStructuredOutput,
} from '@rooferslabs/shared';
import { buildLeadSummaryMessage, CallProcessingService } from './call-processing.service';
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
    transcript: [],
    detectedLanguages: ['en'],
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

describe('getCallerContext', () => {
  type Deps = ConstructorParameters<typeof CallProcessingService>;

  function build(call: unknown, customer: unknown = null) {
    const prisma = { call: { findUnique: jest.fn().mockResolvedValue(call) } };
    const customers = { findByPhone: jest.fn().mockResolvedValue(customer) };
    const service = new CallProcessingService(
      prisma as unknown as Deps[0],
      {} as Deps[1],
      customers as unknown as Deps[2],
      {} as Deps[3],
      {} as Deps[4],
      {} as Deps[5],
    );
    return { service, prisma, customers };
  }

  const CALL = {
    companyId: 'co-1',
    fromNumber: '+15125551234',
    toNumber: '+15125550100',
    twilioCallSid: 'CA123',
  };

  it('reads the caller ID off the call record rather than trusting the media stream', async () => {
    // The stream's custom parameters are attacker-supplied — only the
    // callId/companyId pair is covered by the stream token — and a forged number
    // would be spoken aloud to a real caller and written onto a real lead.
    const { service, prisma } = build(CALL);

    const context = await service.getCallerContext('call-1');

    expect(prisma.call.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'call-1' } }),
    );
    expect(context.callerNumber).toBe('+15125551234');
    expect(context.dialedNumber).toBe('+15125550100');
    expect(context.twilioCallSid).toBe('CA123');
  });

  it('attaches the CRM record the caller ID already matches', async () => {
    const { service, customers } = build(CALL, {
      fullName: 'Dana Whitfield',
      propertyAddress: '18 Balcones Dr, Austin TX 78731',
      propertyType: PropertyType.RESIDENTIAL,
    });

    const context = await service.getCallerContext('call-1');

    expect(customers.findByPhone).toHaveBeenCalledWith('co-1', '+15125551234');
    expect(context.knownCustomer?.fullName).toBe('Dana Whitfield');
  });

  it('reports no caller number when the caller withheld it, and skips the CRM lookup', async () => {
    const { service, customers } = build({ ...CALL, fromNumber: 'anonymous' });

    const context = await service.getCallerContext('call-1');

    expect(context.callerNumber).toBeNull();
    expect(customers.findByPhone).not.toHaveBeenCalled();
  });

  it('degrades to an anonymous context instead of failing the call', async () => {
    // A live caller must be answered even when this lookup breaks; the cost of
    // failing is dead air, and the cost of degrading is one extra question.
    const prisma = { call: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) } };
    const service = new CallProcessingService(
      prisma as unknown as Deps[0],
      {} as Deps[1],
      { findByPhone: jest.fn() } as unknown as Deps[2],
      {} as Deps[3],
      {} as Deps[4],
      {} as Deps[5],
    );

    await expect(service.getCallerContext('call-1')).resolves.toEqual({
      callerNumber: null,
      dialedNumber: null,
      twilioCallSid: null,
      knownCustomer: null,
    });
  });

  it('degrades the same way for a call that no longer exists', async () => {
    const { service } = build(null);
    expect((await service.getCallerContext('gone')).callerNumber).toBeNull();
  });
});
