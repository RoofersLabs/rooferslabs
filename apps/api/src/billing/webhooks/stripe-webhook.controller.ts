import { BadRequestException, Controller, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { respond } from '../../common/response';
import { WebhookProcessorService } from '../services/webhook-processor.service';

/**
 * Stripe webhook receiver — preserved, and not registered.
 *
 * BillingModule only adds this controller to the module when
 * PAYMENT_PROVIDER=stripe, so while PayPal is active the route does not exist:
 * a delivery to it 404s rather than reaching code that would fail a signature
 * check. Kept whole so re-enabling Stripe needs no code, only configuration.
 */
/** Exempt from the global rate limit, for the reasons on the PayPal receiver. */
@SkipThrottle()
@ApiTags('Billing')
@Controller({ path: 'billing/webhook/stripe', version: '1' })
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(private readonly processor: WebhookProcessorService) {}

  @Post()
  @Public()
  @ApiExcludeEndpoint()
  async handle(@Req() request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body.');
    }

    try {
      await this.processor.handle({ rawBody, headers: request.headers });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('signature')) {
        this.logger.warn(`Rejected Stripe webhook: ${message}`);
        throw new BadRequestException('Invalid Stripe signature.');
      }
      // Transient — let it surface as 5xx so Stripe retries with its own backoff.
      throw error;
    }

    return respond({ received: true }, 'Webhook processed.');
  }
}
