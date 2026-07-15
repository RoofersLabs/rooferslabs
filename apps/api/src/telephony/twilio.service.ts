import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';
import { AppConfigService } from '../config/app-config.service';

/**
 * Adapter isolating Twilio. Validates inbound webhook signatures and builds the
 * TwiML that connects a call to the Media Streams WebSocket bridge.
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly config: AppConfigService) {}

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
    return response.toString();
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
