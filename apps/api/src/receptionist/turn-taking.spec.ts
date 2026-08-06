import { ReceptionistService } from './receptionist.service';

/**
 * The numbers that decide how fast the receptionist feels.
 *
 * Pinning them in a test looks like testing a constant, and normally would be.
 * It is worth it here because these values are the entire latency budget of the
 * conversation, they are invisible at the call site (they live inside a session
 * payload sent to OpenAI), and the failure they guard against is silent: nobody
 * notices a regression to 500ms in review, and in production it presents as
 * "the AI feels sluggish" months later with no obvious cause.
 *
 * The upper bounds are the contract. The exact values may be tuned; what must
 * not happen is drifting back above the threshold where a caller starts waiting.
 */
describe('turn-taking latency budget', () => {
  const company = {
    name: 'Summit Roofing',
    aiConfiguration: { voice: 'alloy' },
    businessHours: null,
    serviceAreas: [],
    roofingServices: [],
  };

  function buildSession() {
    const service = new ReceptionistService(
      { openai: { realtimeModel: 'gpt-realtime', realtimeVoice: 'alloy' } } as never,
      { getById: jest.fn().mockResolvedValue(company) } as never,
      {} as never,
      {} as never,
    );
    return service.buildSessionConfig('co-1');
  }

  it('ends the caller’s turn well inside half a second', async () => {
    // The dominant per-turn delay. Above ~400ms the pause before the
    // receptionist answers becomes something a caller consciously notices.
    const { session } = await buildSession();
    expect(session.audio.input.turn_detection.silence_duration_ms).toBeLessThanOrEqual(400);
  });

  it('stays clear of the pauses people leave inside a sentence', async () => {
    // The other side of the same number. Intra-sentence pauses run to ~250ms;
    // dropping below 300 starts cutting callers off mid-address.
    const { session } = await buildSession();
    expect(session.audio.input.turn_detection.silence_duration_ms).toBeGreaterThanOrEqual(300);
  });

  it('keeps enough pre-speech padding to not clip the first word', async () => {
    // Retrospective padding on the caller's own audio: it costs no latency and
    // protects the hardest thing to recover from.
    const { session } = await buildSession();
    expect(session.audio.input.turn_detection.prefix_padding_ms).toBeGreaterThanOrEqual(300);
  });

  it('lets the server start the reply and cancel it on barge-in', async () => {
    // Both must stay server-side. Driving either from this process adds a
    // transatlantic round trip to the start of every answer.
    const { session } = await buildSession();
    expect(session.audio.input.turn_detection.create_response).toBe(true);
    expect(session.audio.input.turn_detection.interrupt_response).toBe(true);
  });

  it('streams μ-law both ways so no transcoding sits in the audio path', async () => {
    const { session } = await buildSession();
    expect(session.audio.input.format.type).toBe('audio/pcmu');
    expect(session.audio.output.format.type).toBe('audio/pcmu');
  });

  it('asks for audio out, so the first byte is playable rather than text', async () => {
    const { session } = await buildSession();
    expect(session.output_modalities).toEqual(['audio']);
  });
});
