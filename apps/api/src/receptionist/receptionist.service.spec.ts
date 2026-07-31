import { ReceptionistService } from './receptionist.service';
import { TOOL } from './tools';
import { createEmptySignals } from './session-state';
import type { AppConfigService } from '../config/app-config.service';
import type { CompaniesService } from '../companies/companies.service';
import type { OpenAiService } from '../ai/openai.service';
import type { RagService } from '../ai/rag.service';

/**
 * These cover the strings the tools hand back to the model. They are not
 * cosmetic: everything returned here lands in the Realtime context and steers
 * the next thing the receptionist says.
 */
function makeService(ragResults: Array<{ title: string; content: string }> = []) {
  const rag = { retrieve: jest.fn().mockResolvedValue(ragResults) } as unknown as RagService;
  return new ReceptionistService(
    {} as AppConfigService,
    {} as CompaniesService,
    {} as OpenAiService,
    rag,
  );
}

/**
 * A service wired far enough to build a session: a company whose stored voice we
 * control, and the fleet default from OPENAI_REALTIME_VOICE.
 */
function makeSessionService(storedVoice: string | undefined, fleetVoice: string) {
  const companies = {
    getById: jest.fn().mockResolvedValue({
      name: 'Summit Roofing',
      roofingServices: ['Roof Repair'],
      serviceAreas: ['Austin, TX'],
      businessHours: [],
      emergencyServiceEnabled: true,
      emergencyInstructions: null,
      aiConfiguration:
        storedVoice === undefined
          ? null
          : { assistantName: 'Riley', greeting: 'Thanks for calling!', voice: storedVoice },
    }),
  } as unknown as CompaniesService;
  const config = {
    openai: { realtimeModel: 'gpt-realtime', realtimeVoice: fleetVoice },
  } as unknown as AppConfigService;
  return new ReceptionistService(config, companies, {} as OpenAiService, {} as RagService);
}

describe('buildSessionConfig — realtime voice', () => {
  it('uses the fleet default when the company has never chosen a voice', async () => {
    const session = await makeSessionService(undefined, 'marin').buildSessionConfig('c1');
    expect(session.session.audio.output.voice).toBe('marin');
  });

  it("keeps the company's own voice — the setting is theirs, not the fleet's", async () => {
    const session = await makeSessionService('sage', 'marin').buildSessionConfig('c1');
    expect(session.session.audio.output.voice).toBe('sage');
  });

  it('falls back to the fleet default when the stored voice is blank', async () => {
    const session = await makeSessionService('', 'marin').buildSessionConfig('c1');
    expect(session.session.audio.output.voice).toBe('marin');
  });

  it('carries the voice on the same payload as the audio format, so it is set before any audio', async () => {
    const session = await makeSessionService(undefined, 'marin').buildSessionConfig('c1');
    // The bridge sends this whole object as session.update on socket open and
    // gates the greeting until session.updated — so the voice can never arrive
    // after the first sample.
    expect(session.session.audio.output).toEqual({
      format: { type: 'audio/pcmu' },
      voice: 'marin',
    });
  });
});

describe('executeToolCall — knowledge lookup', () => {
  it('turns a knowledge miss into a bridge instead of a dead end', async () => {
    // The old text ("No specific information is available") ended the thread at
    // exactly the moment a visit is easiest to offer.
    const result = await makeService().executeToolCall(
      'c1',
      createEmptySignals(),
      TOOL.LOOKUP_KNOWLEDGE,
      { query: 'do you finance?' },
    );

    expect(result.output).toContain('Do NOT guess');
    expect(result.output).toContain('callback number');
  });

  it('returns the retrieved articles when there are any', async () => {
    const service = makeService([{ title: 'Warranty', content: '10 year workmanship.' }]);
    const result = await service.executeToolCall(
      'c1',
      createEmptySignals(),
      TOOL.LOOKUP_KNOWLEDGE,
      {
        query: 'warranty',
      },
    );
    expect(result.output).toContain('10 year workmanship.');
  });
});

describe('executeToolCall — customer capture', () => {
  it('reports what is still outstanding so nothing is forgotten', async () => {
    const signals = createEmptySignals();
    const result = await makeService().executeToolCall('c1', signals, TOOL.CAPTURE_CUSTOMER_INFO, {
      fullName: 'Dana Whitfield',
    });

    expect(signals.customer.fullName).toBe('Dana Whitfield');
    expect(result.output).toContain('Still outstanding');
    expect(result.output).toContain('best callback number');
    expect(result.output).not.toContain('name,');
  });

  it('stops asking once everything is captured', async () => {
    const signals = createEmptySignals();
    const result = await makeService().executeToolCall('c1', signals, TOOL.CAPTURE_CUSTOMER_INFO, {
      fullName: 'Dana Whitfield',
      phone: '512-555-0134',
      propertyAddress: '18 Balcones Dr, Austin TX',
      reason: 'Active leak over the kitchen after last night’s storm; needs someone today.',
    });

    expect(result.output).toContain('do not ask for any of it again');
  });

  it('accumulates across calls rather than replacing earlier details', async () => {
    const service = makeService();
    const signals = createEmptySignals();
    await service.executeToolCall('c1', signals, TOOL.CAPTURE_CUSTOMER_INFO, { fullName: 'Ana' });
    await service.executeToolCall('c1', signals, TOOL.CAPTURE_CUSTOMER_INFO, {
      phone: '5125550134',
    });

    expect(signals.customer).toMatchObject({ fullName: 'Ana', phone: '5125550134' });
  });
});

describe('executeToolCall — appointment and emergency coaching', () => {
  it('forbids inventing an arrival time when a visit is booked', async () => {
    const result = await makeService().executeToolCall(
      'c1',
      createEmptySignals(),
      TOOL.REQUEST_APPOINTMENT,
      { serviceRequested: 'roof inspection', preferredTimeWindow: 'morning' },
    );

    expect(result.output).toContain('never state an arrival time yourself');
  });

  it('tells the receptionist to drop qualification once an emergency is flagged', async () => {
    const signals = createEmptySignals();
    const result = await makeService().executeToolCall('c1', signals, TOOL.FLAG_EMERGENCY, {
      reason: 'Water coming through the kitchen ceiling during a storm.',
    });

    expect(signals.emergency?.isEmergency).toBe(true);
    expect(result.output).toContain('Skip any other');
    expect(result.output).toContain('property address');
  });

  it('still signals transfer and hang-up to the bridge', async () => {
    const service = makeService();
    const signals = createEmptySignals();

    expect(
      (await service.executeToolCall('c1', signals, TOOL.TRANSFER_TO_HUMAN, {})).transfer,
    ).toBe(true);
    expect((await service.executeToolCall('c1', signals, TOOL.END_CALL, {})).endCall).toBe(true);
  });
});
