import { EventEmitter } from 'node:events';

/**
 * Mock `ws`: every `new WebSocket()` is a controllable EventEmitter that records
 * what was sent. The first instance created in a test is the Twilio socket; the
 * bridge creates the second (the OpenAI socket) internally.
 */
class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.OPEN;
  sent: Array<Record<string, unknown>> = [];
  constructor() {
    super();
    MockWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(): void {
    this.readyState = 3;
    this.emit('close');
  }
  /** Deliver a JSON event as if it arrived from the peer. */
  deliver(event: Record<string, unknown>): void {
    this.emit('message', Buffer.from(JSON.stringify(event)));
  }
  types(): string[] {
    return this.sent.map((m) => m.type as string);
  }
}

jest.mock('ws', () => ({ WebSocket: MockWebSocket }));

// Imported after the mock so the bridge binds to MockWebSocket.
import { MediaStreamBridge } from './media-stream.bridge';

/** The bridge's real constructor dependency types, derived from its signature. */
type BridgeDeps = ConstructorParameters<typeof MediaStreamBridge>;
/** The `ws` WebSocket type `handleConnection` expects. */
type BridgeSocket = Parameters<MediaStreamBridge['handleConnection']>[0];

const flush = async (): Promise<void> => {
  // Enough ticks to drain the connect path, which awaits the caller-context
  // lookup before it awaits the session config.
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** A resolved caller ID, as the call pipeline hands one to the bridge. */
const CALLER_CONTEXT = {
  callerNumber: '+15125551234',
  dialedNumber: '+15125550100',
  twilioCallSid: 'CA123',
  knownCustomer: null,
};

function buildBridge(callerContext: unknown = CALLER_CONTEXT) {
  const config = {
    openai: {
      apiKey: 'sk-test',
      realtimeUrl: 'wss://example/realtime',
      realtimeModel: 'gpt-realtime',
    },
    isProduction: false,
  };
  const receptionist = {
    buildSessionConfig: jest.fn().mockResolvedValue({
      model: 'gpt-realtime',
      greeting: 'Thanks for calling Summit Roofing!',
      session: { type: 'realtime' },
    }),
    executeToolCall: jest.fn().mockResolvedValue({ output: 'ok', endCall: false }),
  };
  const callProcessing = {
    finalizeCall: jest.fn().mockResolvedValue(undefined),
    markCallEnded: jest.fn().mockResolvedValue(undefined),
    getCallerContext: jest.fn().mockResolvedValue(callerContext),
  };
  const twilio = {
    verifyStreamToken: jest.fn().mockReturnValue(true),
    startCallRecording: jest.fn().mockResolvedValue(true),
    hangupCall: jest.fn().mockResolvedValue(true),
    endCallWithMessage: jest.fn().mockResolvedValue(true),
  };
  // Active by default: these cases are about the bridge's own behaviour, and a
  // gate that refused would make every one of them assert nothing.
  const accountStatus = {
    ensureActive: jest.fn().mockResolvedValue({ allowed: true, status: 'ACTIVE' }),
  };
  const bridge = new MediaStreamBridge(
    config as unknown as BridgeDeps[0],
    receptionist as unknown as BridgeDeps[1],
    callProcessing as unknown as BridgeDeps[2],
    twilio as unknown as BridgeDeps[3],
    accountStatus as unknown as BridgeDeps[4],
  );
  return { bridge, receptionist, callProcessing, twilio, accountStatus };
}

/**
 * Close anything a case left open.
 *
 * A live session holds a max-duration timeout and a tenant-status interval, and
 * both keep the Jest worker alive after the assertions finish — the suite ran
 * only because Jest force-exited it. Closing the Twilio socket is what production
 * does when a caller hangs up, so this drives the real teardown path rather than
 * reaching in and clearing timers.
 */
afterEach(() => {
  for (const ws of MockWebSocket.instances) {
    if (ws.readyState === MockWebSocket.OPEN) ws.close();
  }
  MockWebSocket.instances = [];
});

/** Start a session and return the Twilio + OpenAI mock sockets, OpenAI socket opened. */
async function startSession(callerContext: unknown = CALLER_CONTEXT) {
  MockWebSocket.instances = [];
  const { bridge, receptionist, callProcessing } = buildBridge(callerContext);
  const twilioWs = new MockWebSocket();
  bridge.handleConnection(twilioWs as unknown as BridgeSocket);

  twilioWs.deliver({
    event: 'start',
    start: {
      streamSid: 'MZ123',
      callSid: 'CA123',
      customParameters: { callId: 'call-1', companyId: 'co-1', token: 'tok' },
    },
  });
  await flush(); // buildSessionConfig resolves → OpenAI socket created

  const openaiWs = MockWebSocket.instances[1];
  if (!openaiWs) throw new Error('OpenAI socket was not created');
  openaiWs.emit('open');
  return { twilioWs, openaiWs, receptionist, callProcessing };
}

/** The guidance texts the bridge injected as system items on a socket. */
function guidanceTexts(ws: MockWebSocket): string[] {
  return ws.sent
    .filter((m) => m.type === 'conversation.item.create')
    .map((m) => m.item as { role?: string; content?: { text?: string }[] } | undefined)
    .filter((item) => item?.role === 'system')
    .map((item) => item?.content?.[0]?.text ?? '');
}

/** Deliver a completed tool call and let the async handler settle. */
async function deliverToolCall(
  ws: MockWebSocket,
  name: string,
  args: Record<string, unknown>,
): Promise<void> {
  ws.deliver({
    type: 'response.function_call_arguments.done',
    name,
    call_id: 'fc-1',
    arguments: JSON.stringify(args),
  });
  await flush();
}

describe('MediaStreamBridge caller-turn handling', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('sends session.update on open but gates the greeting and caller audio until session.updated', async () => {
    const { twilioWs, openaiWs } = await startSession();

    // On open: session.update sent, but NOT the greeting yet.
    expect(openaiWs.types()).toContain('session.update');
    expect(openaiWs.types()).not.toContain('response.create');

    // Caller audio before activation is dropped (never mis-framed).
    twilioWs.deliver({ event: 'media', media: { payload: 'AAAA', timestamp: '20' } });
    expect(openaiWs.types()).not.toContain('input_audio_buffer.append');

    // session.updated → greeting + audio gate opens.
    openaiWs.deliver({ type: 'session.updated' });
    expect(openaiWs.types()).toContain('response.create');

    twilioWs.deliver({ event: 'media', media: { payload: 'BBBB', timestamp: '40' } });
    expect(openaiWs.types()).toContain('input_audio_buffer.append');
  });

  it('forces a response when the server does not auto-create one after a caller turn', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.done' }); // greeting finished
    const before = openaiWs.sent.length;

    // Caller turn committed, but the server never emits response.created.
    openaiWs.deliver({ type: 'input_audio_buffer.committed' });
    jest.advanceTimersByTime(1000);

    const forced = openaiWs.sent.slice(before).filter((m) => m.type === 'response.create');
    expect(forced).toHaveLength(1); // the watchdog guaranteed a response
  });

  it('does not force a response when the server auto-creates one', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.done' });
    const before = openaiWs.sent.length;

    openaiWs.deliver({ type: 'input_audio_buffer.committed' });
    openaiWs.deliver({ type: 'response.created' }); // server auto-response arrives
    jest.advanceTimersByTime(1000);

    const forced = openaiWs.sent.slice(before).filter((m) => m.type === 'response.create');
    expect(forced).toHaveLength(0); // no double-response
  });
});

describe('MediaStreamBridge orchestration wiring', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('injects turn guidance as a system item at the turn boundary', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    expect(guidanceTexts(openaiWs)).toHaveLength(0); // nothing before a turn ends

    openaiWs.deliver({ type: 'response.done' });

    const [guidance] = guidanceTexts(openaiWs);
    expect(guidance).toContain('YOUR OBJECTIVE THIS TURN:');
    expect(guidance).toContain('never read aloud');
  });

  it('stages guidance without provoking a response of its own', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    const before = openaiWs.sent.length;

    openaiWs.deliver({ type: 'response.done' });

    // Guidance is context for the caller's next turn, not a turn of its own:
    // a response.create here would make the AI talk to itself.
    expect(guidanceTexts(openaiWs)).toHaveLength(1);
    expect(openaiWs.sent.slice(before).filter((m) => m.type === 'response.create')).toHaveLength(0);
  });

  it('tells the model what a tool call already captured, so it never asks twice', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });

    await deliverToolCall(openaiWs, 'capture_customer_info', {
      fullName: 'Dana Whitfield',
      propertyAddress: '18 Balcones Dr, Austin TX 78731',
    });
    openaiWs.deliver({ type: 'response.done' });

    const guidance = guidanceTexts(openaiWs).at(-1) ?? '';
    expect(guidance).toContain('Already known (never ask again)');
    expect(guidance).toContain('Dana Whitfield');
  });

  it('keeps what the caller already said across an OpenAI reconnect', async () => {
    const { openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    await deliverToolCall(openaiWs, 'capture_customer_info', { fullName: 'Dana Whitfield' });

    // OpenAI drops mid-call; the bridge reconnects transparently.
    openaiWs.close();
    await flush();
    const reconnected = MockWebSocket.instances[2];
    if (!reconnected) throw new Error('bridge did not reconnect');
    reconnected.emit('open');
    reconnected.deliver({ type: 'session.updated' });
    reconnected.deliver({ type: 'response.done' });

    // A new socket, but the same call: forgetting the name here would make the
    // AI ask a caller who already answered.
    expect(guidanceTexts(reconnected).at(-1) ?? '').toContain('Dana Whitfield');
  });

  it('knows the caller number before the model speaks, and never asks for it', async () => {
    const { openaiWs, receptionist } = await startSession();

    // The number has to be in the session instructions, not just in guidance:
    // the greeting is spoken before any guidance has been injected.
    expect(receptionist.buildSessionConfig).toHaveBeenCalledWith(
      'co-1',
      expect.objectContaining({ callerNumber: '+15125551234' }),
    );

    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.done' });

    const guidance = guidanceTexts(openaiWs).at(-1) ?? '';
    expect(guidance).toContain('Already known (never ask again)');
    expect(guidance).toContain('+15125551234');
    // The objective is the actual proof: the planner picked something else to
    // pursue, so no turn is ever spent asking for a number we already have.
    expect(guidance).not.toContain('Get the best callback number.');
  });

  it('falls back to asking when the call arrived with no caller ID', async () => {
    const withheld = { ...CALLER_CONTEXT, callerNumber: null };
    const { openaiWs } = await startSession(withheld);
    openaiWs.deliver({ type: 'session.updated' });

    // Everything else is collected, so the number is all that is left to want.
    await deliverToolCall(openaiWs, 'capture_customer_info', {
      fullName: 'Dana Whitfield',
      reason: 'Missing shingles after the last storm',
      propertyAddress: '18 Balcones Dr, Austin TX 78731',
    });
    openaiWs.deliver({ type: 'response.done' });

    const guidance = guidanceTexts(openaiWs).at(-1) ?? '';
    expect(guidance).toContain('Get the best callback number.');
  });

  it('resolves the caller context once, not again on every reconnect', async () => {
    const { openaiWs, callProcessing } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });

    openaiWs.close();
    await flush();
    const reconnected = MockWebSocket.instances[2];
    if (!reconnected) throw new Error('bridge did not reconnect');
    reconnected.emit('open');

    expect(callProcessing.getCallerContext).toHaveBeenCalledTimes(1);
  });

  it('stops injecting guidance once the call is over', async () => {
    const { twilioWs, openaiWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.done' });
    const before = guidanceTexts(openaiWs).length;

    twilioWs.close(); // caller hung up → finalize
    await flush();
    openaiWs.deliver({ type: 'response.done' }); // a late event still in flight

    expect(guidanceTexts(openaiWs)).toHaveLength(before);
  });
});

/**
 * A live call is the one unit of work on this platform that outlives the moment
 * it was authorised. These cases cover what happens when the founder pauses an
 * account while a caller is still on the line.
 */
describe('tenant status during a call', () => {
  /** Build a bridge whose gate answers `allowed` on the Nth check and after. */
  function bridgeWithGate(answers: boolean[]) {
    MockWebSocket.instances = [];
    const built = buildBridge();
    let call = 0;
    built.accountStatus.ensureActive.mockImplementation(() => {
      const allowed = answers[Math.min(call, answers.length - 1)] ?? true;
      call += 1;
      return Promise.resolve({ allowed, status: allowed ? 'ACTIVE' : 'PAUSED' });
    });
    return built;
  }

  function startStream(bridge: MediaStreamBridge) {
    const twilioWs = new MockWebSocket();
    bridge.handleConnection(twilioWs as unknown as BridgeSocket);
    twilioWs.deliver({
      event: 'start',
      start: {
        streamSid: 'MZ123',
        callSid: 'CA123',
        customParameters: { callId: 'call-1', companyId: 'co-1', token: 'tok' },
      },
    });
    return twilioWs;
  }

  it('never opens an OpenAI session for a tenant paused before the stream arrived', async () => {
    // The webhook admitted the call, then the founder paused. The stream is the
    // second gate, and it is what keeps this call free.
    const { bridge, receptionist, twilio } = bridgeWithGate([false]);
    const twilioWs = startStream(bridge);
    await flush();

    expect(MockWebSocket.instances).toHaveLength(1); // Twilio's socket only
    expect(receptionist.buildSessionConfig).not.toHaveBeenCalled();
    expect(twilio.startCallRecording).not.toHaveBeenCalled();
    expect(twilioWs.readyState).not.toBe(MockWebSocket.OPEN);
  });

  it('tells the caller the office is unavailable rather than dropping the line', async () => {
    const { bridge, twilio } = bridgeWithGate([false]);
    startStream(bridge);
    await flush();

    expect(twilio.endCallWithMessage).toHaveBeenCalledWith(
      'CA123',
      expect.stringContaining('office'),
    );
  });

  it('writes no conversation for a call it refused', async () => {
    // `callId` is cleared on refusal precisely so finalize leaves the record
    // alone: a refused call must not produce an AI-analysed transcript.
    const { bridge, callProcessing } = bridgeWithGate([false]);
    const twilioWs = startStream(bridge);
    await flush();
    twilioWs.close();
    await flush();

    expect(callProcessing.finalizeCall).not.toHaveBeenCalled();
  });

  it('terminates a call in progress when the tenant is paused mid-conversation', async () => {
    jest.useFakeTimers();
    try {
      // Allowed at the stream gate, refused by the watcher 15 seconds later.
      const { bridge, twilio } = bridgeWithGate([true, false]);
      startStream(bridge);
      await flush();

      const openaiWs = MockWebSocket.instances[1];
      if (!openaiWs) throw new Error('OpenAI socket was not created');
      openaiWs.emit('open');

      await jest.advanceTimersByTimeAsync(15_000);
      await flush();

      // The meter is stopped and the caller is told something true.
      expect(openaiWs.readyState).not.toBe(MockWebSocket.OPEN);
      expect(twilio.endCallWithMessage).toHaveBeenCalledWith(
        'CA123',
        expect.stringContaining('no longer available'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves a call alone while the tenant stays active', async () => {
    jest.useFakeTimers();
    try {
      const { bridge, twilio } = bridgeWithGate([true]);
      startStream(bridge);
      await flush();
      const openaiWs = MockWebSocket.instances[1];
      openaiWs?.emit('open');

      await jest.advanceTimersByTimeAsync(60_000); // four watch ticks
      await flush();

      expect(twilio.endCallWithMessage).not.toHaveBeenCalled();
      expect(openaiWs?.readyState).toBe(MockWebSocket.OPEN);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the call up when the status lookup itself fails', async () => {
    // A database blip is not a pause. Hanging up on a live caller because a
    // query failed would turn a transient fault into a lost customer.
    jest.useFakeTimers();
    try {
      MockWebSocket.instances = [];
      const built = buildBridge();
      built.accountStatus.ensureActive
        .mockResolvedValueOnce({ allowed: true, status: 'ACTIVE' })
        .mockRejectedValue(new Error('db down'));
      startStream(built.bridge);
      await flush();
      MockWebSocket.instances[1]?.emit('open');

      await jest.advanceTimersByTimeAsync(15_000);
      await flush();

      expect(built.twilio.endCallWithMessage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * The audio path, from the caller finishing a sentence to hearing an answer.
 *
 * These cases are about *when* things happen rather than what: audio forwarded
 * on the first delta rather than at the end of a response, playback abandoned
 * the instant the caller speaks over it, and the model's context corrected to
 * match what the caller actually heard.
 */
describe('streaming and interruption', () => {
  it('forwards the first audio delta immediately, without waiting for the response', async () => {
    const { openaiWs, twilioWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.created' });

    const before = twilioWs.sent.filter((m) => m.event === 'media').length;
    openaiWs.deliver({
      type: 'response.output_audio.delta',
      delta: 'AAAA',
      item_id: 'item-1',
    });

    // One delta in, one frame out — no buffering, no waiting for response.done.
    const after = twilioWs.sent.filter((m) => m.event === 'media');
    expect(after).toHaveLength(before + 1);
    expect((after.at(-1) as { media?: { payload?: string } }).media?.payload).toBe('AAAA');
  });

  it('keeps streaming every delta as it arrives', async () => {
    const { openaiWs, twilioWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    for (const chunk of ['AAAA', 'BBBB', 'CCCC']) {
      openaiWs.deliver({ type: 'response.output_audio.delta', delta: chunk, item_id: 'i' });
    }
    const payloads = twilioWs.sent
      .filter((m) => m.event === 'media')
      .map((m) => (m as { media: { payload: string } }).media.payload);
    expect(payloads).toEqual(['AAAA', 'BBBB', 'CCCC']);
  });

  it('drops queued audio the moment the caller talks over the AI', async () => {
    // Twilio buffers what it has been sent. Without the clear, the caller keeps
    // hearing the abandoned sentence after they interrupted it.
    const { openaiWs, twilioWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    openaiWs.deliver({ type: 'response.output_audio.delta', delta: 'AAAA', item_id: 'item-1' });

    openaiWs.deliver({ type: 'input_audio_buffer.speech_started' });

    expect(twilioWs.sent.some((m) => m.event === 'clear')).toBe(true);
  });

  it('truncates the assistant turn at the point the caller actually heard', async () => {
    // The model must believe it said only what was played, or its next turn
    // refers to words the caller never heard.
    const { openaiWs, twilioWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    twilioWs.emit(
      'message',
      Buffer.from(JSON.stringify({ event: 'media', media: { timestamp: '1000', payload: 'x' } })),
    );
    openaiWs.deliver({ type: 'response.output_audio.delta', delta: 'AAAA', item_id: 'item-1' });
    twilioWs.emit(
      'message',
      Buffer.from(JSON.stringify({ event: 'media', media: { timestamp: '2500', payload: 'x' } })),
    );

    openaiWs.deliver({ type: 'input_audio_buffer.speech_started' });

    const truncate = openaiWs.sent.find((m) => m.type === 'conversation.item.truncate');
    expect(truncate).toBeDefined();
    expect(truncate?.item_id).toBe('item-1');
    expect(truncate?.audio_end_ms).toBeGreaterThan(0);
  });

  it('never sends a negative truncation point', async () => {
    // Twilio's clock is not guaranteed monotonic across a reconnect; a negative
    // offset is rejected by OpenAI and would leave the context uncorrected.
    const { openaiWs, twilioWs } = await startSession();
    openaiWs.deliver({ type: 'session.updated' });
    twilioWs.emit(
      'message',
      Buffer.from(JSON.stringify({ event: 'media', media: { timestamp: '5000', payload: 'x' } })),
    );
    openaiWs.deliver({ type: 'response.output_audio.delta', delta: 'AAAA', item_id: 'item-1' });
    twilioWs.emit(
      'message',
      Buffer.from(JSON.stringify({ event: 'media', media: { timestamp: '100', payload: 'x' } })),
    );

    openaiWs.deliver({ type: 'input_audio_buffer.speech_started' });

    const truncate = openaiWs.sent.find((m) => m.type === 'conversation.item.truncate');
    expect(truncate?.audio_end_ms).toBeGreaterThanOrEqual(0);
  });

  it('holds caller audio back until the session is confirmed configured', async () => {
    // Frames sent before session.updated would be interpreted in the wrong
    // format, which corrupts the turn rather than merely delaying it.
    MockWebSocket.instances = [];
    const { bridge } = buildBridge();
    const twilioWs = new MockWebSocket();
    bridge.handleConnection(twilioWs as unknown as BridgeSocket);
    twilioWs.deliver({
      event: 'start',
      start: {
        streamSid: 'MZ1',
        callSid: 'CA1',
        customParameters: { callId: 'call-1', companyId: 'co-1', token: 't' },
      },
    });
    await flush();
    const openaiWs = MockWebSocket.instances[1];
    openaiWs?.emit('open');

    twilioWs.deliver({ event: 'media', media: { timestamp: '20', payload: 'CALLER' } });
    expect(openaiWs?.types()).not.toContain('input_audio_buffer.append');

    openaiWs?.deliver({ type: 'session.updated' });
    twilioWs.deliver({ event: 'media', media: { timestamp: '40', payload: 'CALLER' } });
    expect(openaiWs?.types()).toContain('input_audio_buffer.append');
  });
});
