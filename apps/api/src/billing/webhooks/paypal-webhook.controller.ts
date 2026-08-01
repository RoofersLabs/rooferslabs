import { BadRequestException, Controller, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { respond } from '../../common/response';
import { WebhookVerificationError } from '../providers/paypal/paypal.webhook';
import { WebhookProcessorService } from '../services/webhook-processor.service';

/**
 * PayPal webhook receiver — the only path by which subscription state changes.
 *
 * The endpoint is public (PayPal cannot present a Clerk token) but never
 * unauthenticated: every payload is verified with PayPal itself, against the raw
 * request body, before a single byte is trusted.
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
 * The limiter is keyed by IP and every delivery arrives from PayPal's small pool
 * of them, so a burst — a busy renewal day, or PayPal working through a retry
 * backlog — would trip a shared 120/min bucket and start rejecting real
 * subscription state changes. A 429 is at least retried rather than lost, but
 * throttling the payment provider is an availability risk with no security
 * benefit: this endpoint's protection is the signature check, which is far
 * stronger than an IP counter and rejects an unsigned request before it can do
 * any work at all.
 */
@SkipThrottle()
@ApiTags('Billing')
@Controller({ path: 'billing/webhook/paypal', version: '1' })
export class PayPalWebhookController {
  private readonly logger = new Logger(PayPalWebhookController.name);

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
      // A verification failure is permanent: the same bytes will never verify on
      // a retry. 400 tells PayPal to stop, which keeps a probe or a
      // misconfigured webhook id from generating retries indefinitely.
      //
      // Matched on the error *type*, not on its message. PayPal verification is
      // an outbound API call, so "the signature was rejected" and "the call to
      // ask about the signature failed" are both plausible, and only the first
      // is permanent — a substring check would eventually classify an outage as
      // a forgery and discard a real subscription change.
      if (error instanceof WebhookVerificationError) {
        this.logger.warn(`Rejected PayPal webhook: ${error.message}`);
        throw new BadRequestException('Invalid PayPal webhook signature.');
      }

      // Everything else — a database blip, a provider read that timed out, a
      // failed verification *call* — is transient. Letting it propagate as a 5xx
      // is what makes PayPal retry with its own backoff rather than silently
      // dropping a state change.
      throw error;
    }

    if (outcome.duplicate) {
      this.logger.debug(`Duplicate PayPal event ${outcome.eventType} acknowledged.`);
    }
    return respond({ received: true }, 'Webhook processed.');
  }
}
