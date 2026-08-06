import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import twilio from 'twilio';
import { AppConfigService } from '../config/app-config.service';

/**
 * Adapter isolating Twilio. Validates inbound webhook signatures, builds the
 * TwiML that connects a call to the Media Streams WebSocket bridge, and sends
 * outbound SMS (post-call lead alerts and customer acknowledgements).
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: ReturnType<typeof twilio> | null = null;

  constructor(private readonly config: AppConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.config.twilio.accountSid && this.config.twilio.authToken);
  }

  get isSmsEnabled(): boolean {
    return this.isConfigured;
  }

  private get rest(): ReturnType<typeof twilio> {
    this.client ??= twilio(this.config.twilio.accountSid, this.config.twilio.authToken);
    return this.client;
  }

  /**
   * Find one available local US voice number, preferring the given area code.
   * Returns null when nothing is available (callers retry without the area
   * code before giving up).
   */
  async searchAvailableLocalNumber(areaCode?: string): Promise<string | null> {
    const [match] = await this.rest.availablePhoneNumbers('US').local.list({
      ...(areaCode ? { areaCode: Number(areaCode) } : {}),
      voiceEnabled: true,
      limit: 1,
    });
    return match?.phoneNumber ?? null;
  }

  private webhookConfig(): {
    voiceUrl: string;
    voiceMethod: 'POST';
    statusCallback: string;
    statusCallbackMethod: 'POST';
  } {
    const base = this.config.api.publicUrl;
    return {
      voiceUrl: `${base}/v1/telephony/incoming`,
      voiceMethod: 'POST',
      statusCallback: `${base}/v1/telephony/status`,
      statusCallbackMethod: 'POST',
    };
  }

  /** Numbers the Twilio account already owns (used to adopt before purchasing). */
  async listOwnedNumbers(): Promise<{ sid: string; phoneNumber: string; friendlyName: string }[]> {
    const owned = await this.rest.incomingPhoneNumbers.list({ limit: 50 });
    return owned.map((n) => ({
      sid: n.sid,
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
    }));
  }

  /** Point an owned number's Voice webhook + status callback at this API. */
  async configureNumberWebhooks(sid: string, friendlyName?: string): Promise<void> {
    await this.rest.incomingPhoneNumbers(sid).update({
      ...this.webhookConfig(),
      ...(friendlyName ? { friendlyName } : {}),
    });
  }

  /**
   * Purchase an incoming number via the Twilio REST API, configuring its Voice
   * webhook and status callback in the same call so the number is answerable
   * the moment it exists. Throws on failure — the caller owns rollback.
   */
  async purchaseNumber(params: {
    phoneNumber: string;
    friendlyName: string;
  }): Promise<{ sid: string; phoneNumber: string; friendlyName: string }> {
    const purchased = await this.rest.incomingPhoneNumbers.create({
      phoneNumber: params.phoneNumber,
      friendlyName: params.friendlyName,
      ...this.webhookConfig(),
    });
    return {
      sid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
      friendlyName: purchased.friendlyName,
    };
  }

  /**
   * Release a purchased number (rollback path when persistence fails after a
   * successful purchase). Best-effort: a failure here is logged by the caller
   * and the orphaned number surfaces in the Twilio console.
   */
  async releaseNumber(sid: string): Promise<void> {
    await this.rest.incomingPhoneNumbers(sid).remove();
  }

  /**
   * Start recording an in-progress call (dual-channel: caller + AI). Twilio
   * reports lifecycle transitions to the recording-status webhook. Best-effort:
   * returns false on failure so a recording problem never touches the call.
   */
  async startCallRecording(callSid: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      await this.rest.calls(callSid).recordings.create({
        recordingChannels: 'dual',
        recordingStatusCallback: `${this.config.api.publicUrl}/v1/telephony/recording-status`,
        recordingStatusCallbackMethod: 'POST',
        recordingStatusCallbackEvent: ['completed', 'failed', 'absent'],
      });
      return true;
    } catch (error) {
      this.logger.warn(`Starting recording for ${callSid} failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * End a live call cleanly via REST (used when the AI wraps up and hangs up).
   * Returns whether Twilio accepted the hangup — the caller falls back to
   * closing the media stream when it did not.
   */
  async hangupCall(callSid: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      await this.rest.calls(callSid).update({ status: 'completed' });
      return true;
    } catch (error) {
      this.logger.warn(`Hanging up ${callSid} failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Interrupt a live call, say one sentence, and hang up.
   *
   * Used when a tenant is paused mid-call. A bare {@link hangupCall} would drop
   * the line silently, which to the caller is indistinguishable from the product
   * failing — they would redial, and reach the same wall. Replacing the call's
   * TwiML speaks the message and then ends it, so the caller is told something
   * true and the media stream is torn down by Twilio as a consequence.
   *
   * Best-effort, like every other REST call here: a failure is logged and the
   * bridge falls back to closing the socket itself.
   */
  async endCallWithMessage(callSid: string, message: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      // The same builder the inbound webhook uses, so the voice matches and the
      // message is XML-escaped by the SDK rather than by hand.
      await this.rest.calls(callSid).update({ twiml: this.buildRejectTwiml(message) });
      return true;
    } catch (error) {
      this.logger.warn(`Ending ${callSid} with a message failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Fetch a recording's audio from Twilio (recordings require account auth,
   * so the dashboard streams them through our API). Returns the raw response
   * so the controller can pipe status, type, and body straight through.
   */
  async fetchRecordingMedia(recordingSid: string): Promise<Response> {
    const { accountSid, authToken } = this.config.twilio;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
    return fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });
  }

  /**
   * Send an SMS. Returns whether the message was accepted by Twilio; failures
   * are logged and swallowed — SMS is a best-effort notification channel and
   * must never break the call pipeline.
   */
  async sendSms(params: { to: string; from: string; body: string }): Promise<boolean> {
    if (!this.isSmsEnabled) {
      this.logger.debug('Twilio credentials not set — skipping SMS.');
      return false;
    }
    if (!params.to || !params.from) return false;
    try {
      this.client ??= twilio(this.config.twilio.accountSid, this.config.twilio.authToken);
      await this.client.messages.create({
        to: params.to,
        from: params.from,
        body: params.body,
      });
      return true;
    } catch (error) {
      this.logger.warn(`SMS to ${params.to} failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Verify a Twilio webhook signature. In non-production environments without an
   * auth token configured, validation is skipped so the flow can be exercised
   * locally; production always enforces it.
   */
  validateSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, unknown>,
  ): boolean {
    const authToken = this.config.twilio.authToken;
    if (!authToken) {
      if (this.config.isProduction) return false;
      this.logger.warn('TWILIO_AUTH_TOKEN not set — skipping signature validation (dev only).');
      return true;
    }
    if (!signature) return false;
    return twilio.validateRequest(authToken, signature, url, params as Record<string, string>);
  }

  /** TwiML that streams call audio to the Media Streams bridge. */
  buildStreamTwiml(params: { wssUrl: string; callId: string; companyId: string }): string {
    const response = new twilio.twiml.VoiceResponse();
    const connect = response.connect();
    const stream = connect.stream({ url: params.wssUrl });
    stream.parameter({ name: 'callId', value: params.callId });
    stream.parameter({ name: 'companyId', value: params.companyId });
    stream.parameter({
      name: 'token',
      value: this.signStreamToken(params.callId, params.companyId),
    });
    // Plays only if the media stream ends while the caller is still on the
    // line (AI failure/timeouts) — a graceful goodbye instead of dead air.
    // Normal calls end with the caller hanging up, so this never plays.
    response.say(
      { voice: 'Polly.Joanna' },
      'We are sorry — we are having trouble connecting you right now. Please call back in a few minutes, or leave us a message online.',
    );
    response.hangup();
    return response.toString();
  }

  /**
   * HMAC token embedded in the Media Streams TwiML so the WebSocket bridge only
   * accepts sessions this server created. Keyed on the Twilio auth token, which
   * never leaves the backend, so the callId/companyId pair cannot be forged.
   */
  signStreamToken(callId: string, companyId: string): string {
    const authToken = this.config.twilio.authToken;
    if (!authToken) return '';
    return createHmac('sha256', authToken).update(`${callId}:${companyId}`).digest('hex');
  }

  /** Verify a Media Streams token. Without an auth token: dev allows, production rejects. */
  verifyStreamToken(token: string | undefined, callId: string, companyId: string): boolean {
    const authToken = this.config.twilio.authToken;
    if (!authToken) {
      if (this.config.isProduction) return false;
      this.logger.warn('TWILIO_AUTH_TOKEN not set — skipping stream token validation (dev only).');
      return true;
    }
    if (!token) return false;
    const expected = Buffer.from(this.signStreamToken(callId, companyId), 'hex');
    const provided = Buffer.from(token, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }

  /** TwiML that politely rejects a call (unconfigured number, inactive company). */
  buildRejectTwiml(message: string): string {
    const response = new twilio.twiml.VoiceResponse();
    response.say(
      { voice: 'Polly.Joanna' },
      message || 'We are unable to take your call right now. Please try again later.',
    );
    response.hangup();
    return response.toString();
  }
}
