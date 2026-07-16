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

  get isSmsEnabled(): boolean {
    return Boolean(this.config.twilio.accountSid && this.config.twilio.authToken);
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
