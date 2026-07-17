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
  private sessionConfig: RealtimeSessionConfig | null = null;
  private readonly signals: LiveConversationSignals = createEmptySignals();
  private readonly transcript: TranscriptEntry[] = [];
  private readonly startedAt = Date.now();
  private finalized = false;
  private openaiReady = false;
  private reconnects = 0;
  private maxDurationTimer: NodeJS.Timeout | null = null;

  // Interruption bookkeeping: Twilio's media timestamp is the playback clock.
  // When the caller barges in we truncate the assistant's conversation item at
  // the audio position actually heard, so the model's context matches reality.
  private latestMediaTimestamp = 0;
  private activeAssistantItemId: string | null = null;
  private responseStartTimestamp: number | null = null;

  constructor(
    private readonly twilioWs: WebSocket,
    private readonly config: AppConfigService,
    private readonly receptionist: ReceptionistService,
    private readonly callProcessing: CallProcessingService,
    private readonly twilio: TwilioService,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.twilioWs.on('message', (raw) => this.onTwilioMessage(raw));
    this.twilioWs.on('close', () => void this.finalize(CallStatus.COMPLETED));
    this.twilioWs.on('error', (err) => {
      this.logger.warn(`Twilio socket error: ${err.message}`);
      void this.finalize(CallStatus.FAILED);
    });
    this.maxDurationTimer = setTimeout(() => {
      this.logger.warn(
        `Call ${this.callId} hit the ${MAX_CALL_DURATION_MS / 60000}-minute safety cap; ending.`,
      );
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
        void this.finalize(CallStatus.COMPLETED);
        break;
      default:
        break;
    }
  }

  private onStart(message: TwilioInboundMessage): void {
    this.streamSid = message.start?.streamSid ?? null;
    const params = message.start?.customParameters ?? {};
    this.callId = params.callId ?? null;
    this.companyId = params.companyId ?? null;

    if (!this.callId || !this.companyId) {
      this.logger.error('Media stream started without callId/companyId; closing.');
      this.twilioWs.close();
      return;
    }
    if (!this.twilio.verifyStreamToken(params.token, this.callId, this.companyId)) {
      this.logger.error(
        `Media stream for call ${this.callId} presented an invalid token; closing.`,
      );
      this.callId = null; // do not touch the call record for an unauthenticated stream
      this.twilioWs.close();
      return;
    }
    void this.connectOpenAi(this.companyId);
  }

  private onMedia(message: TwilioInboundMessage): void {
    const payload = message.media?.payload;
    if (!payload) return;
    const timestamp = Number(message.media?.timestamp);
    if (Number.isFinite(timestamp)) this.latestMediaTimestamp = timestamp;
    if (!this.openaiReady || this.openaiWs?.readyState !== WebSocket.OPEN) return;
    this.sendToOpenAi({ type: 'input_audio_buffer.append', audio: payload });
  }

  private async connectOpenAi(companyId: string): Promise<void> {
    const apiKey = this.config.openai.apiKey;
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY not configured; cannot run the AI receptionist.');
      await this.failCall();
      return;
    }

    try {
      this.sessionConfig ??= await this.receptionist.buildSessionConfig(companyId);
    } catch (error) {
      this.logger.error(
        `Failed to build the realtime session for company ${companyId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      await this.failCall();
      return;
    }
    const session = this.sessionConfig;

    const url = `${this.config.openai.realtimeUrl}?model=${encodeURIComponent(session.model)}`;
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      handshakeTimeout: OPENAI_CONNECT_TIMEOUT_MS,
    });
    this.openaiWs = ws;
    const isReconnect = this.reconnects > 0;

    ws.on('open', () => {
      this.sendToOpenAi({ type: 'session.update', session: session.session });
      this.sendToOpenAi({
        type: 'response.create',
        response: {
          instructions: isReconnect
            ? 'You briefly lost the line for a moment. Apologize in a few words and ask the caller to continue.'
            : `Greet the caller warmly with: "${session.greeting}"`,
        },
      });
      this.openaiReady = true;
    });

    ws.on('message', (raw) => void this.onOpenAiMessage(raw));
    ws.on('close', () => void this.onOpenAiClosed());
    ws.on('error', (err) =>
      this.logger.error(`OpenAI realtime socket error (call ${this.callId}): ${err.message}`),
    );
  }

  /**
   * OpenAI dropped (timeout, 429 close, network, internal error). The Twilio
   * call must survive: reconnect once with the same session; if that fails,
   * end the stream so the caller hears the recorded fallback message instead
   * of dead air (TwiML after <Connect> plays when the stream ends).
   */
  private async onOpenAiClosed(): Promise<void> {
    this.openaiReady = false;
    if (this.finalized || this.twilioWs.readyState !== WebSocket.OPEN) {
      void this.finalize(CallStatus.COMPLETED);
      return;
    }

    if (this.reconnects < MAX_OPENAI_RECONNECTS && this.companyId) {
      this.reconnects += 1;
      this.logger.warn(
        `OpenAI realtime session dropped mid-call ${this.callId}; reconnecting (attempt ${this.reconnects}).`,
      );
      await this.connectOpenAi(this.companyId);
      return;
    }

    this.logger.error(
      `OpenAI realtime session lost for call ${this.callId} and reconnect failed; ending stream gracefully.`,
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
      case 'response.output_audio.delta':
        if (event.delta && this.streamSid) {
          if (event.item_id) this.activeAssistantItemId = event.item_id;
          this.responseStartTimestamp ??= this.latestMediaTimestamp;
          this.sendToTwilio({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: event.delta },
          });
        }
        break;

      case 'input_audio_buffer.speech_started':
        // Barge-in. The session's interrupt_response cancels generation
        // server-side; we drop Twilio's queued audio and truncate the
        // assistant item at the position the caller actually heard.
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

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) this.pushTranscript('customer', event.transcript);
        break;

      case 'response.output_audio_transcript.done':
        if (event.transcript) this.pushTranscript('assistant', event.transcript);
        break;

      case 'response.function_call_arguments.done':
        await this.handleFunctionCall(event);
        break;

      case 'response.done':
        this.activeAssistantItemId = null;
        this.responseStartTimestamp = null;
        break;

      case 'error':
        if (!BENIGN_OPENAI_ERRORS.has(event.error?.code ?? '')) {
          this.logger.warn(
            `OpenAI realtime error event for call ${this.callId}: ` +
              `${event.error?.code ?? 'unknown'} — ${event.error?.message ?? 'no message'}`,
          );
        }
        break;

      default:
        break;
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

    const result = await this.receptionist.executeToolCall(
      this.companyId,
      this.signals,
      event.name,
      args,
    );

    this.sendToOpenAi({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: event.call_id, output: result.output },
    });
    this.sendToOpenAi({ type: 'response.create' });
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
    const durationSeconds = Math.round((Date.now() - this.startedAt) / 1000);

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
      this.logger.error(`Failed to finalize call ${this.callId}: ${(error as Error).message}`);
    }
  }
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
  error?: { type?: string; code?: string; message?: string };
}
