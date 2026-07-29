import { BadRequestException, Controller, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { respond } from '../../common/response';
import { WebhookProcessorService } from '../services/webhook-processor.service';

/**
 * Paddle webhook receiver — the only path by which subscription state changes.
 *
 * The endpoint is public (Paddle cannot present a Clerk token) but never
 * unauthenticated: every payload is verified against the signing secret using
 * the raw request body before a single byte is trusted.
 *
 * Mounted at its own provider-specific path rather than a shared one. Two
 * processors' webhooks are not interchangeable — they carry different
 * signatures on different headers — so giving each its own route means a
 * misdirected delivery 404s instead of failing a signature check for reasons
 * nobody can diagnose from the logs.
 */
/**
 * Exempt from the global rate limit.
 *
 * The limiter is keyed by IP and every delivery arrives from Paddle's small
 * pool of them, so a burst — a busy renewal day, or Paddle working through a
 * retry backlog — would trip a shared 120/min bucket and start rejecting real
 * subscription state changes. A 429 is at least retried rather than lost, but
 * throttling the payment provider is an availability risk with no security
 * benefit: this endpoint's protection is the HMAC signature check, which is far
 * stronger than an IP counter and rejects an unsigned request before it can do
 * any work at all.
 */
@SkipThrottle()
@ApiTags('Billing')
@Controller({ path: 'billing/webhook/paddle', version: '1' })
export class PaddleWebhookController {
  private readonly logger = new Logger(PaddleWebhookController.name);

  constructor(private readonly processor: WebhookProcessorService) {}

  @Post()
  @Public()
  @ApiExcludeEndpoint()
  async handle(@Req() request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      // Without the untouched bytes the signature can never be validated.
      throw new BadRequestException('Missing raw request body.');
    }

    let outcome;
    try {
      outcome = await this.processor.handle({ rawBody, headers: request.headers });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // A verification failure is permanent: the same bytes will never verify
      // on a retry. 400 tells Paddle to stop, which keeps a probe or a
      // misconfigured secret from generating retries indefinitely.
      if (isVerificationFailure(message)) {
        this.logger.warn(`Rejected Paddle webhook: ${message}`);
        throw new BadRequestException('Invalid Paddle signature.');
      }

      // Everything else — a database blip, a provider read that timed out — is
      // transient. Letting it propagate as a 5xx is what makes Paddle retry
      // with its own backoff rather than silently dropping a state change.
      throw error;
    }

    if (outcome.duplicate) {
      this.logger.debug(`Duplicate Paddle event ${outcome.eventType} acknowledged.`);
    }
    return respond({ received: true }, 'Webhook processed.');
  }
}

/**
 * Whether a failure came from signature verification rather than from applying
 * the event.
 *
 * Matched on the message because the Paddle SDK raises plain errors for this.
 * The fallback is to treat a failure as transient, which is the safe direction:
 * an unnecessary retry costs nothing, whereas wrongly returning 400 would
 * discard a real subscription change.
 */
function isVerificationFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('signature') ||
    normalized.includes('paddle-signature') ||
    normalized.includes('could not be parsed')
  );
}
