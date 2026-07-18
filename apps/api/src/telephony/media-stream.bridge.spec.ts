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

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

function buildBridge() {
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
    executeToolCall: jest.fn(),
  };
  const callProcessing = {
    finalizeCall: jest.fn().mockResolvedValue(undefined),
    markCallEnded: jest.fn().mockResolvedValue(undefined),
  };
  const twilio = {
    verifyStreamToken: jest.fn().mockReturnValue(true),
    startCallRecording: jest.fn().mockResolvedValue(true),
    hangupCall: jest.fn().mockResolvedValue(true),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bridge = new MediaStreamBridge(
    config as any,
    receptionist as any,
    callProcessing as any,
    twilio as any,
  );
  return { bridge, receptionist };
}

/** Start a session and return the Twilio + OpenAI mock sockets, OpenAI socket opened. */
async function startSession() {
  MockWebSocket.instances = [];
  const { bridge } = buildBridge();
  const twilioWs = new MockWebSocket();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bridge.handleConnection(twilioWs as any);

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
  return { twilioWs, openaiWs };
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
