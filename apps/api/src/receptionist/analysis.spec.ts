import type { ConversationStructuredOutput, TranscriptEntry } from '@rooferslabs/shared';
import { ReceptionistService } from './receptionist.service';
import { createEmptySignals } from './session-state';

type Args = ConstructorParameters<typeof ReceptionistService>;

/**
 * The post-call pass, end to end: one model call producing the structured
 * record, the summary and the normalized transcript together.
 *
 * What these cases protect is the seam between "the model said so" and "we
 * stored it". The prompt is centralised and tested elsewhere; here the question
 * is whether the service composes it, and whether it is willing to reject the
 * model's transcript when that transcript no longer matches the call.
 */

const RAW: TranscriptEntry[] = [
  { role: 'assistant', text: 'thanks for calling summit roofing', offsetMs: 0 },
  { role: 'customer', text: 'uh yeah my my roof is is leaking real bad', offsetMs: 1500 },
];

function analysis(overrides: Partial<ConversationStructuredOutput> = {}) {
  return {
    intent: 'EMERGENCY_REPAIR',
    outcome: 'EMERGENCY',
    leadQuality: 'HOT',
    urgency: 'HIGH',
    customer: {
      fullName: null,
      phone: null,
      email: null,
      propertyAddress: null,
      propertyType: 'RESIDENTIAL',
    },
    serviceType: 'Emergency leak repair',
    appointment: {
      requested: false,
      serviceRequested: null,
      preferredDate: null,
      preferredTimeWindow: null,
      priority: 'HIGH',
      notes: null,
    },
    emergency: { isEmergency: true, urgency: 'HIGH', reason: 'Active leak' },
    summary: 'Caller: Unidentified.\nReason for Call: Active roof leak.',
    keyPoints: ['Active leak reported'],
    followUpRequired: true,
    followUpReason: 'Schedule an emergency inspection.',
    transcript: [
      {
        role: 'assistant',
        text: 'Thanks for calling Summit Roofing.',
        originalText: null,
        lowConfidence: false,
      },
      {
        role: 'customer',
        text: 'My roof is leaking badly.',
        originalText: null,
        lowConfidence: false,
      },
    ],
    detectedLanguages: ['en'],
    ...overrides,
  } as unknown as ConversationStructuredOutput;
}

function build(modelAnswer: unknown, isEnabled = true) {
  const openai = {
    isEnabled,
    createStructuredResponse: jest.fn().mockResolvedValue(modelAnswer),
  };
  const service = new ReceptionistService(
    { openai: { realtimeModel: 'm', realtimeVoice: 'alloy' } } as unknown as Args[0],
    { getById: jest.fn().mockResolvedValue({ name: 'Summit Roofing' }) } as unknown as Args[1],
    openai as unknown as Args[2],
    {} as unknown as Args[3],
  );
  return { service, openai };
}

describe('post-call analysis', () => {
  it('sends the centralized instructions and the numbered transcript', async () => {
    const { service, openai } = build(analysis());
    await service.analyzeConversation('co-1', RAW, createEmptySignals());

    const [, params] = openai.createStructuredResponse.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(params.instructions).toContain('Summit Roofing');
    expect(params.instructions).toContain('LANGUAGE POLICY');
    expect(params.instructions).toContain('NEVER INVENT');
    expect(params.input).toBe(
      '[1] AI: thanks for calling summit roofing\n[2] Caller: uh yeah my my roof is is leaking real bad',
    );
  });

  it('makes exactly one model call for the record, summary and transcript', async () => {
    // Three outputs, one round trip. A second call would cost latency and could
    // disagree with the first about what was said.
    const { service, openai } = build(analysis());
    await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(openai.createStructuredResponse).toHaveBeenCalledTimes(1);
  });

  it('keeps a normalized transcript that still matches the call', async () => {
    const { service } = build(analysis());
    const result = await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(result.transcript).toHaveLength(2);
    expect(result.transcript[1]?.text).toBe('My roof is leaking badly.');
  });

  it('discards a normalized transcript that lost a turn', async () => {
    // The model rewrote the call into something shorter. The structured record
    // and summary are still usable; the transcript is not, and an empty one is
    // the signal to store what was actually recorded.
    const { service } = build(
      analysis({
        transcript: [
          {
            role: 'assistant',
            text: 'Thanks for calling.',
            originalText: null,
            lowConfidence: false,
          },
        ] as never,
      }),
    );
    const result = await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(result.transcript).toEqual([]);
    // Everything else survives — one bad field does not throw the call away.
    expect(result.summary).toContain('Reason for Call');
    expect(result.emergency.isEmergency).toBe(true);
  });

  it('falls back to the deterministic path when the model is unavailable', async () => {
    const { service, openai } = build(null, false);
    const result = await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(openai.createStructuredResponse).not.toHaveBeenCalled();
    // No model ran, so nothing was normalized — and it does not pretend
    // otherwise by presenting recogniser output as normalized.
    expect(result.transcript).toEqual([]);
    expect(result.detectedLanguages).toEqual([]);
  });

  it('falls back when the adapter declines for a gated tenant', async () => {
    const { service } = build(null, true);
    const result = await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(result.transcript).toEqual([]);
    expect(result.summary).toContain('Inbound call');
  });

  it('survives a model failure without losing the call', async () => {
    const openai = {
      isEnabled: true,
      createStructuredResponse: jest.fn().mockRejectedValue(new Error('502 from provider')),
    };
    const service = new ReceptionistService(
      { openai: {} } as unknown as Args[0],
      { getById: jest.fn().mockResolvedValue({ name: 'Summit Roofing' }) } as unknown as Args[1],
      openai as unknown as Args[2],
      {} as unknown as Args[3],
    );
    const result = await service.analyzeConversation('co-1', RAW, createEmptySignals());
    expect(result.summary).toContain('Inbound call');
  });

  it('passes a mixed-language call through with its translation intact', async () => {
    const raw: TranscriptEntry[] = [
      { role: 'customer', text: 'mi techo tiene una gotera', offsetMs: 0 },
    ];
    const { service } = build(
      analysis({
        detectedLanguages: ['es'],
        transcript: [
          {
            role: 'customer',
            text: 'My roof has a leak.',
            originalText: 'mi techo tiene una gotera',
            lowConfidence: false,
          },
        ] as never,
      }),
    );
    const result = await service.analyzeConversation('co-1', raw, createEmptySignals());
    expect(result.transcript[0]?.text).toBe('My roof has a leak.');
    expect(result.detectedLanguages).toEqual(['es']);
  });
});
