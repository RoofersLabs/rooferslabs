import { Injectable, Logger } from '@nestjs/common';
import { WebSocket, type RawData } from 'ws';
import type { TranscriptEntry } from '@rooferslabs/shared';
import { CallStatus } from '@rooferslabs/shared';
import { AppConfigService } from '../config/app-config.service';
import { ReceptionistService } from '../receptionist/receptionist.service';
import { CallProcessingService } from '../calls/call-processing.service';
import { TwilioService } from './twilio.service';
import { createEmptySignals, type LiveConversationSignals } from '../receptionist/session-state';

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

/** Hard safety cap on a single call so a stuck socket can never burn an
 *  unbounded OpenAI Realtime session. Well above any legitimate call length. */
const MAX_CALL_DURATION_MS = 30 * 60 * 1000;

/**
 * Bridges a single Twilio Media Streams WebSocket to an OpenAI Realtime session.
 * Audio flows both ways as g711 μ-law; the model's tool calls are executed
 * against the company knowledge base and structured signals, and the completed
 * call is handed to the call pipeline for persistence.
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
  private readonly signals: LiveConversationSignals = createEmptySignals();
  private readonly transcript: TranscriptEntry[] = [];
  private readonly startedAt = Date.now();
  private finalized = false;
  private openaiReady = false;
  private maxDurationTimer: NodeJS.Timeout | null = null;

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
    if (!payload || !this.openaiReady || this.openaiWs?.readyState !== WebSocket.OPEN) return;
    this.sendToOpenAi({ type: 'input_audio_buffer.append', audio: payload });
  }

  private async connectOpenAi(companyId: string): Promise<void> {
    const apiKey = this.config.openai.apiKey;
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY not configured; cannot run the AI receptionist.');
      this.twilioWs.close();
      await this.callProcessing.markCallEnded(this.callId!, CallStatus.FAILED);
      return;
    }

    const session = await this.receptionist.buildSessionConfig(companyId);
    const ws = new WebSocket(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(session.model)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'OpenAI-Beta': 'realtime=v1' },
    });
    this.openaiWs = ws;

    ws.on('open', () => {
      this.sendToOpenAi({
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: session.instructions,
          voice: session.voice,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          tools: session.tools,
          tool_choice: 'auto',
          temperature: 0.7,
        },
      });
      // Have the AI speak first with the configured greeting.
      this.sendToOpenAi({
        type: 'response.create',
        response: { instructions: `Greet the caller warmly: "${session.greeting}"` },
      });
      this.openaiReady = true;
    });

    ws.on('message', (raw) => void this.onOpenAiMessage(raw));
    ws.on('close', () => void this.finalize(CallStatus.COMPLETED));
    ws.on('error', (err) => this.logger.warn(`OpenAI realtime error: ${err.message}`));
  }

  private async onOpenAiMessage(raw: RawData): Promise<void> {
    let event: OpenAiRealtimeEvent;
    try {
      event = JSON.parse(raw.toString()) as OpenAiRealtimeEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case 'response.audio.delta':
        if (event.delta && this.streamSid) {
          this.sendToTwilio({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: event.delta },
          });
        }
        break;

      case 'input_audio_buffer.speech_started':
        // Barge-in: caller started talking — stop queued AI audio.
        if (this.streamSid) this.sendToTwilio({ event: 'clear', streamSid: this.streamSid });
        this.sendToOpenAi({ type: 'response.cancel' });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) this.pushTranscript('customer', event.transcript);
        break;

      case 'response.audio_transcript.done':
        if (event.transcript) this.pushTranscript('assistant', event.transcript);
        break;

      case 'response.function_call_arguments.done':
        await this.handleFunctionCall(event);
        break;

      case 'error':
        // Benign cancellation races are expected (barge-in with no active
        // response); anything else is worth surfacing in the logs.
        if (event.error?.code !== 'response_cancel_not_active') {
          this.logger.warn(
            `OpenAI realtime error event for call ${this.callId}: ${event.error?.message ?? 'unknown'}`,
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
  media?: { payload: string };
}

interface OpenAiRealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: { code?: string; message?: string };
}
