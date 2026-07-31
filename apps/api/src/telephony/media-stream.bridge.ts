import { Injectable, Logger } from '@nestjs/common';
import { WebSocket, type RawData } from 'ws';
import type { TranscriptEntry } from '@rooferslabs/shared';
import { CallStatus } from '@rooferslabs/shared';
import { AppConfigService } from '../config/app-config.service';
import {
  ReceptionistService,
  type RealtimeSessionConfig,
} from '../receptionist/receptionist.service';
import { CallProcessingService } from '../calls/call-processing.service';
import { TwilioService } from './twilio.service';
import { createEmptySignals, type LiveConversationSignals } from '../receptionist/session-state';
import { ConversationOrchestrator } from '../receptionist/orchestrator';
import { TOOL } from '../receptionist/tools';

/** Hard safety cap on a single call so a stuck socket can never burn an
 *  unbounded OpenAI Realtime session. Well above any legitimate call length. */
const MAX_CALL_DURATION_MS = 30 * 60 * 1000;

/** Budget for the OpenAI WebSocket handshake before the call fails over. */
const OPENAI_CONNECT_TIMEOUT_MS = 10_000;

/** One transparent reconnect if OpenAI drops mid-call; then fail gracefully. */
const MAX_OPENAI_RECONNECTS = 1;

/** GA error codes that are expected during normal barge-in races. */
const BENIGN_OPENAI_ERRORS = new Set(['response_cancel_not_active']);

/**
 * If `session.updated` hasn't arrived this long after the socket opens, activate
 * anyway (send the greeting, start accepting audio) so a missing/renamed ack can
 * never leave the caller in silence.
 */
const SESSION_ACTIVATION_FALLBACK_MS = 2_000;

/**
 * After a caller turn is committed we expect the server (server VAD with
 * create_response) to auto-create a response almost immediately. If none appears
 * within this window we create one explicitly — the safety net that guarantees
 * the AI always answers a completed caller turn, even if the server's implicit
 * auto-response does not fire. This is the fix for "silent after greeting".
 */
const RESPONSE_WATCHDOG_MS = 700;

/** Grace period after end_call so the farewell audio finishes playing. */
const HANGUP_GRACE_MS = 2500;

/**
 * Bridges a single Twilio Media Streams WebSocket to an OpenAI Realtime GA
 * session (wss://api.openai.com/v1/realtime, no beta header). Audio flows both
 * ways as g711 μ-law; the model's tool calls are executed against the company
 * knowledge base and structured signals, and the completed call is handed to
 * the call pipeline for persistence.
 */
@Injectable()
export class MediaStreamBridge {
  private readonly logger = new Logger(MediaStreamBridge.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly receptionist: ReceptionistService,
    private readonly callProcessing: CallProcessingService,
    private readonly twilio: TwilioService,
  ) {}

  handleConnection(twilioWs: WebSocket): void {
    new CallBridgeSession(
      twilioWs,
      this.config,
      this.receptionist,
      this.callProcessing,
      this.twilio,
      this.logger,
    ).start();
  }
}

class CallBridgeSession {
  private openaiWs: WebSocket | null = null;
  private streamSid: string | null = null;
  private callId: string | null = null;
  private companyId: string | null = null;
  private twilioCallSid: string | null = null;
  private sessionConfig: RealtimeSessionConfig | null = null;
  private readonly signals: LiveConversationSignals = createEmptySignals();
  private readonly transcript: TranscriptEntry[] = [];

  /**
   * Owns conversation state, stage, priorities, and quality for this call. The
   * bridge stays a transport: it reports what happened and injects whatever
   * guidance comes back, but decides nothing about the conversation itself.
   */
  private orchestrator: ConversationOrchestrator | null = null;
  private readonly startedAt = Date.now();
  private finalized = false;
  private reconnects = 0;
  private maxDurationTimer: NodeJS.Timeout | null = null;

  // Session activation gate: caller audio is only appended once the session is
  // confirmed configured (μ-law + server VAD), so no frame is ever fed to OpenAI
  // in the wrong format. Set on `session.updated` (or the fallback timer).
  private sessionActivated = false;
  private activationFallbackTimer: NodeJS.Timeout | null = null;

  // Deterministic turn-taking: a response must be in flight or one is forced.
  private responseActive = false;
  private responseWatchdog: NodeJS.Timeout | null = null;

  // Interruption bookkeeping: Twilio's media timestamp is the playback clock.
  // When the caller barges in we truncate the assistant's conversation item at
  // the audio position actually heard, so the model's context matches reality.
  private latestMediaTimestamp = 0;
  private activeAssistantItemId: string | null = null;
  private responseStartTimestamp: number | null = null;

  // Observability counters (logged once at finalize; a single call is traceable).
  private callerAudioFrames = 0;
  private assistantAudioFrames = 0;
  private callerTurns = 0;
  private assistantResponses = 0;
  private forcedResponses = 0;

  constructor(
    private readonly twilioWs: WebSocket,
    private readonly config: AppConfigService,
    private readonly receptionist: ReceptionistService,
    private readonly callProcessing: CallProcessingService,
    private readonly twilio: TwilioService,
    private readonly logger: Logger,
  ) {}

  /** Correlation-tagged structured log line — every call is traceable end-to-end. */
  private log(level: 'debug' | 'log' | 'warn' | 'error', message: string): void {
    this.logger[level](`[call=${this.callId ?? 'pending'}] ${message}`);
  }

  start(): void {
    this.twilioWs.on('message', (raw) => this.onTwilioMessage(raw));
    this.twilioWs.on('close', () => void this.finalize(CallStatus.COMPLETED));
    this.twilioWs.on('error', (err) => {
      this.log('warn', `Twilio socket error: ${err.message}`);
      void this.finalize(CallStatus.FAILED);
    });
    this.maxDurationTimer = setTimeout(() => {
      this.log('warn', `hit the ${MAX_CALL_DURATION_MS / 60000}-minute safety cap; ending.`);
      void this.finalize(CallStatus.COMPLETED);
    }, MAX_CALL_DURATION_MS);
  }

  private onTwilioMessage(raw: RawData): void {
    let message: TwilioInboundMessage;
    try {
      message = JSON.parse(raw.toString()) as TwilioInboundMessage;
    } catch {
      return;
    }

    switch (message.event) {
      case 'start':
        this.onStart(message);
        break;
      case 'media':
        this.onMedia(message);
        break;
      case 'stop':
        this.log('debug', 'Twilio stream stopped.');
        void this.finalize(CallStatus.COMPLETED);
        break;
      default:
        break;
    }
  }

  private onStart(message: TwilioInboundMessage): void {
    this.streamSid = message.start?.streamSid ?? null;
    this.twilioCallSid = message.start?.callSid ?? null;
    const params = message.start?.customParameters ?? {};
    this.callId = params.callId ?? null;
    this.companyId = params.companyId ?? null;

    if (!this.callId || !this.companyId) {
      this.logger.error('Media stream started without callId/companyId; closing.');
      this.twilioWs.close();
      return;
    }
    if (!this.twilio.verifyStreamToken(params.token, this.callId, this.companyId)) {
      this.log('error', 'media stream presented an invalid token; closing.');
      this.callId = null; // do not touch the call record for an unauthenticated stream
      this.twilioWs.close();
      return;
    }

    this.log('log', `Twilio media stream started (streamSid=${this.streamSid}).`);

    // Record every answered call (dual-channel); best-effort, never blocking.
    if (this.twilioCallSid) {
      void this.twilio.startCallRecording(this.twilioCallSid);
    }

    void this.connectOpenAi(this.companyId);
  }

  private onMedia(message: TwilioInboundMessage): void {
    const payload = message.media?.payload;
    if (!payload) return;
    const timestamp = Number(message.media?.timestamp);
    if (Number.isFinite(timestamp)) this.latestMediaTimestamp = timestamp;
    // Drop caller audio until the session is confirmed configured (μ-law + VAD),
    // so OpenAI never mis-frames a frame sent under the default format.
    if (!this.sessionActivated || this.openaiWs?.readyState !== WebSocket.OPEN) return;
    this.callerAudioFrames += 1;
    this.sendToOpenAi({ type: 'input_audio_buffer.append', audio: payload });
  }

  private async connectOpenAi(companyId: string): Promise<void> {
    const apiKey = this.config.openai.apiKey;
    if (!apiKey) {
      this.log('error', 'OPENAI_API_KEY not configured; cannot run the AI receptionist.');
      await this.failCall();
      return;
    }

    try {
      this.sessionConfig ??= await this.receptionist.buildSessionConfig(companyId);
    } catch (error) {
      this.log(
        'error',
        `failed to build the realtime session for company ${companyId}: ${(error as Error).message}`,
      );
      await this.failCall();
      return;
    }
    const session = this.sessionConfig;

    // One orchestrator per call, not per connection: a mid-call reconnect must
    // not forget the caller's name. Only created if this is the first connect.
    const tools = Array.isArray(session.session.tools) ? session.session.tools : [];
    this.orchestrator ??= new ConversationOrchestrator(
      tools.some((tool) => tool.name === TOOL.TRANSFER_TO_HUMAN),
    );

    // Reset per-connection state (a reconnect reuses the same session config).
    this.sessionActivated = false;
    this.responseActive = false;
    this.clearActivationFallback();
    this.clearResponseWatchdog();

    const url = `${this.config.openai.realtimeUrl}?model=${encodeURIComponent(session.model)}`;
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      handshakeTimeout: OPENAI_CONNECT_TIMEOUT_MS,
    });
    this.openaiWs = ws;

    ws.on('open', () => {
      this.log(
        'log',
        `OpenAI realtime socket open; sending session.update (model=${session.model}).`,
      );
      // Configure the session up front. Audio + the greeting stay gated until
      // the server acknowledges with `session.updated` (or the fallback fires).
      this.sendToOpenAi({ type: 'session.update', session: session.session });
      this.activationFallbackTimer = setTimeout(() => {
        this.log(
          'warn',
          'session.updated not received within the activation window; activating on fallback.',
        );
        this.activateSession();
      }, SESSION_ACTIVATION_FALLBACK_MS);
    });

    ws.on('message', (raw) => void this.onOpenAiMessage(raw));
    ws.on('close', () => void this.onOpenAiClosed());
    ws.on('error', (err) => this.log('error', `OpenAI realtime socket error: ${err.message}`));
  }

  /**
   * Session is confirmed configured: speak the greeting and open the audio gate.
   * Idempotent — the `session.updated` ack and the fallback timer both call it.
   */
  private activateSession(): void {
    if (this.sessionActivated || !this.sessionConfig) return;
    this.sessionActivated = true;
    this.clearActivationFallback();

    const isReconnect = this.reconnects > 0;
    this.sendToOpenAi({
      type: 'response.create',
      response: {
        instructions: isReconnect
          ? 'You briefly lost the line for a moment. Apologize in a few words and ask the caller to continue.'
          : `Greet the caller warmly with: "${this.sessionConfig.greeting}"`,
      },
    });
    this.log(
      'log',
      isReconnect
        ? 'session re-activated (reconnect); apologizing.'
        : 'session active; greeting caller.',
    );
  }

  /**
   * OpenAI dropped (timeout, 429 close, network, internal error). The Twilio
   * call must survive: reconnect once with the same session; if that fails,
   * end the stream so the caller hears the recorded fallback message instead
   * of dead air (TwiML after <Connect> plays when the stream ends).
   */
  private async onOpenAiClosed(): Promise<void> {
    this.sessionActivated = false;
    this.clearActivationFallback();
    this.clearResponseWatchdog();
    if (this.finalized || this.twilioWs.readyState !== WebSocket.OPEN) {
      void this.finalize(CallStatus.COMPLETED);
      return;
    }

    if (this.reconnects < MAX_OPENAI_RECONNECTS && this.companyId) {
      this.reconnects += 1;
      this.log(
        'warn',
        `OpenAI realtime session dropped mid-call; reconnecting (attempt ${this.reconnects}).`,
      );
      await this.connectOpenAi(this.companyId);
      return;
    }

    this.log(
      'error',
      'OpenAI realtime session lost and reconnect failed; ending stream gracefully.',
    );
    await this.finalize(CallStatus.COMPLETED);
  }

  /** Fail the call before any AI audio: end the stream so the TwiML fallback plays. */
  private async failCall(): Promise<void> {
    if (this.callId) {
      await this.callProcessing.markCallEnded(this.callId, CallStatus.FAILED);
    }
    this.finalized = true;
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.twilioWs.close();
  }

  private async onOpenAiMessage(raw: RawData): Promise<void> {
    let event: OpenAiRealtimeEvent;
    try {
      event = JSON.parse(raw.toString()) as OpenAiRealtimeEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case 'session.created':
        this.log('debug', 'session.created received.');
        break;

      case 'session.updated':
        // The session is now configured (μ-law in/out + server VAD). Speak the
        // greeting and open the audio gate.
        this.log('debug', 'session.updated received; activating.');
        this.activateSession();
        break;

      case 'input_audio_buffer.speech_started':
        // Caller started talking (turn start or barge-in). If a response is
        // playing, the session's interrupt_response cancels it server-side; we
        // drop Twilio's queued audio and truncate the assistant item at the
        // position the caller actually heard.
        this.log('debug', 'caller speech started.');
        if (this.responseActive) this.orchestrator?.observeInterruption();
        if (this.streamSid) this.sendToTwilio({ event: 'clear', streamSid: this.streamSid });
        if (this.activeAssistantItemId && this.responseStartTimestamp !== null) {
          this.sendToOpenAi({
            type: 'conversation.item.truncate',
            item_id: this.activeAssistantItemId,
            content_index: 0,
            audio_end_ms: Math.max(0, this.latestMediaTimestamp - this.responseStartTimestamp),
          });
        }
        this.activeAssistantItemId = null;
        this.responseStartTimestamp = null;
        break;

      case 'input_audio_buffer.speech_stopped':
        this.log('debug', 'caller speech stopped.');
        break;

      case 'input_audio_buffer.committed':
        // The caller's turn was captured. Server VAD (create_response) should
        // now auto-create a response; arm the watchdog so we force one if it
        // silently does not — guaranteeing the AI always answers.
        this.callerTurns += 1;
        this.log('debug', `caller turn committed (#${this.callerTurns}); awaiting response.`);
        this.armResponseWatchdog();
        break;

      case 'response.created':
        this.responseActive = true;
        this.assistantResponses += 1;
        this.clearResponseWatchdog();
        this.log('debug', `response.created (#${this.assistantResponses}).`);
        break;

      case 'response.output_audio.delta':
        if (event.delta && this.streamSid) {
          if (event.item_id) this.activeAssistantItemId = event.item_id;
          this.responseStartTimestamp ??= this.latestMediaTimestamp;
          this.assistantAudioFrames += 1;
          this.sendToTwilio({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: event.delta },
          });
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          this.log('debug', `caller transcript: ${truncate(event.transcript)}`);
          this.pushTranscript('customer', event.transcript);
          this.orchestrator?.observeCallerTurn(event.transcript);
        }
        break;

      case 'response.output_audio_transcript.done':
        if (event.transcript) {
          this.log('debug', `assistant transcript: ${truncate(event.transcript)}`);
          this.pushTranscript('assistant', event.transcript);
          const findings = this.orchestrator?.observeAssistantTurn(event.transcript) ?? [];
          for (const finding of findings) {
            this.log('debug', `quality: ${finding.code} — ${finding.detail}`);
          }
        }
        break;

      case 'response.function_call_arguments.done':
        this.log('debug', `tool call: ${event.name}`);
        await this.handleFunctionCall(event);
        break;

      case 'response.done':
        this.responseActive = false;
        this.activeAssistantItemId = null;
        this.responseStartTimestamp = null;
        this.log('debug', 'response.done.');
        // The turn boundary is the one race-free moment to steer the next turn:
        // no response is in flight, and the caller's transcript for the turn
        // just finished has already been applied to state.
        this.injectGuidance();
        break;

      case 'error':
        // Never swallow: benign barge-in cancel races are debug, everything
        // else is a loud error with the full payload so a bad session config
        // or rejected event is immediately visible in one test call.
        if (BENIGN_OPENAI_ERRORS.has(event.error?.code ?? '')) {
          this.log('debug', `benign OpenAI error: ${event.error?.code}`);
        } else {
          this.log(
            'error',
            `OpenAI realtime error: ${event.error?.code ?? 'unknown'} — ` +
              `${event.error?.message ?? 'no message'}${
                event.error?.param ? ` (param: ${event.error.param})` : ''
              }`,
          );
        }
        break;

      default:
        break;
    }
  }

  /**
   * Arm the fallback that forces a response if the server's implicit
   * auto-response (server VAD create_response) does not fire after a caller
   * turn. This is what makes turn-taking deterministic instead of dependent on
   * an unobservable server behavior.
   */
  private armResponseWatchdog(): void {
    this.clearResponseWatchdog();
    this.responseWatchdog = setTimeout(() => {
      this.responseWatchdog = null;
      if (this.responseActive || this.finalized) return;
      if (this.openaiWs?.readyState !== WebSocket.OPEN) return;
      this.forcedResponses += 1;
      this.log(
        'warn',
        'no response was auto-created after the caller turn; creating one explicitly ' +
          '(server VAD create_response did not fire).',
      );
      this.sendToOpenAi({ type: 'response.create' });
    }, RESPONSE_WATCHDOG_MS);
  }

  private clearResponseWatchdog(): void {
    if (this.responseWatchdog) {
      clearTimeout(this.responseWatchdog);
      this.responseWatchdog = null;
    }
  }

  private clearActivationFallback(): void {
    if (this.activationFallbackTimer) {
      clearTimeout(this.activationFallbackTimer);
      this.activationFallbackTimer = null;
    }
  }

  private async handleFunctionCall(event: OpenAiRealtimeEvent): Promise<void> {
    if (!event.name || !event.call_id || !this.companyId) return;
    let args: Record<string, unknown> = {};
    try {
      args = event.arguments ? (JSON.parse(event.arguments) as Record<string, unknown>) : {};
    } catch {
      /* tolerate malformed args */
    }

    // Tool calls are the authoritative path into conversation state: structured,
    // synchronous, and immune to the misreadings a transcript is prone to.
    this.orchestrator?.observeToolCall(event.name, args);

    const result = await this.receptionist.executeToolCall(
      this.companyId,
      this.signals,
      event.name,
      args,
    );

    if (result.endCall) {
      // The farewell was spoken before the tool call; give trailing audio a
      // moment to reach the caller, then hang up cleanly via REST (falling
      // back to closing the stream, which plays the recorded goodbye TwiML).
      this.log('log', 'AI wrapped up the call; hanging up.');
      setTimeout(() => {
        void (async () => {
          const hungUp = this.twilioCallSid
            ? await this.twilio.hangupCall(this.twilioCallSid)
            : false;
          if (!hungUp) this.twilioWs.close();
          await this.finalize(CallStatus.COMPLETED);
        })();
      }, HANGUP_GRACE_MS);
      return;
    }

    // Feed the tool result back and ask the model to continue the turn.
    this.sendToOpenAi({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: event.call_id, output: result.output },
    });
    this.sendToOpenAi({ type: 'response.create' });
  }

  /**
   * Hand the orchestrator's plan for the next turn to the model.
   *
   * Sent as a system-role conversation item rather than a `session.update`, so
   * it applies to the next turn only and does not accumulate: replacing the
   * session instructions on every turn would grow the context without bound and
   * make the model's behaviour drift as the call went on.
   *
   * No `response.create` follows — this only stages context. The caller's next
   * turn triggers the response, exactly as before, so nothing about turn-taking
   * or latency changes.
   */
  private injectGuidance(): void {
    if (!this.orchestrator || this.finalized) return;
    if (this.openaiWs?.readyState !== WebSocket.OPEN) return;

    const { plan, guidance } = this.orchestrator.nextTurn();
    this.sendToOpenAi({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text: guidance }],
      },
    });
    this.log(
      'debug',
      `guidance: stage=${plan.stage} target=${plan.targetField ?? 'none'} ` +
        `empathy=${plan.empathy} complete=${this.orchestrator.completenessScore()}%`,
    );
  }

  private pushTranscript(role: 'assistant' | 'customer', text: string): void {
    const trimmed = text.trim();
    if (trimmed)
      this.transcript.push({ role, text: trimmed, offsetMs: Date.now() - this.startedAt });
  }

  private sendToOpenAi(payload: unknown): void {
    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify(payload));
    }
  }

  private sendToTwilio(payload: unknown): void {
    if (this.twilioWs.readyState === WebSocket.OPEN) {
      this.twilioWs.send(JSON.stringify(payload));
    }
  }

  private async finalize(status: CallStatus): Promise<void> {
    if (this.finalized) return;
    this.finalized = true;

    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.clearActivationFallback();
    this.clearResponseWatchdog();

    const durationSeconds = Math.round((Date.now() - this.startedAt) / 1000);
    this.log(
      'log',
      `finalizing (${status}) after ${durationSeconds}s — callerTurns=${this.callerTurns}, ` +
        `assistantResponses=${this.assistantResponses}, forcedResponses=${this.forcedResponses}, ` +
        `callerAudioFrames=${this.callerAudioFrames}, assistantAudioFrames=${this.assistantAudioFrames}, ` +
        `transcriptEntries=${this.transcript.length}.`,
    );

    try {
      this.openaiWs?.close();
    } catch {
      /* ignore */
    }
    try {
      if (this.twilioWs.readyState === WebSocket.OPEN) this.twilioWs.close();
    } catch {
      /* ignore */
    }

    if (!this.callId) return;

    try {
      if (status === CallStatus.COMPLETED) {
        await this.callProcessing.finalizeCall(this.callId, {
          transcript: this.transcript,
          signals: this.signals,
          durationSeconds,
        });
      } else {
        await this.callProcessing.markCallEnded(this.callId, status);
      }
    } catch (error) {
      this.log('error', `failed to finalize call: ${(error as Error).message}`);
    }
  }
}

/** Trim a transcript line for a single-line log without dumping the whole turn. */
function truncate(text: string, max = 120): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

interface TwilioInboundMessage {
  event: 'connected' | 'start' | 'media' | 'mark' | 'stop';
  start?: {
    streamSid: string;
    callSid: string;
    customParameters?: Record<string, string>;
  };
  media?: { payload: string; timestamp?: string };
}

interface OpenAiRealtimeEvent {
  type: string;
  delta?: string;
  item_id?: string;
  transcript?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: { type?: string; code?: string; message?: string; param?: string };
}
