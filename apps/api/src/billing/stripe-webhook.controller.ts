import { BadRequestException, Controller, Headers, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Public } from '../common/decorators/public.decorator';
import { respond } from '../common/response';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

/**
 * Stripe webhook receiver — the only path by which subscription state changes.
 *
 * The endpoint is public (Stripe cannot present a Clerk token) but never
 * unauthenticated: every payload is verified against the signing secret using
 * the raw request body before a single byte is trusted.
 */
@ApiTags('Billing')
@Controller({ path: 'billing/webhook', version: '1' })
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly billing: BillingService,
  ) {}

  @Post()
  @Public()
  @ApiExcludeEndpoint()
  async handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const rawBody = request.rawBody;
    if (!rawBody) {
      // Without the untouched bytes the signature can never be validated.
      throw new BadRequestException('Missing raw request body.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      this.logger.warn(`Rejected Stripe webhook: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Stripe signature.');
    }

    // Failures propagate as 5xx so Stripe retries with its own backoff rather
    // than silently dropping a subscription state change.
    await this.billing.applyWebhookEvent(event);
    this.logger.log(`Processed Stripe event ${event.type} (${event.id})`);

    return respond({ received: true }, 'Webhook processed.');
  }
}
