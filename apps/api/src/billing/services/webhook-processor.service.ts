import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebhookEventStatus } from '@prisma/client';
import { SubscriptionStatus } from '@rooferslabs/shared';
import { BILLING_PROVIDER, type BillingProvider } from '../interfaces/billing-provider.interface';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';
import type { ProviderWebhookEvent, WebhookRequest } from '../types/billing.types';
import { BillingService } from './billing.service';

/** What the controller should tell the provider. */
export interface WebhookOutcome {
  /** False means "retry me": the controller answers 5xx. */
  ok: boolean;
  /** True when the event had already been handled and was skipped. */
  duplicate: boolean;
  eventType: string;
}

/**
 * Inbound webhook handling: verify, deduplicate, apply.
 *
 * Webhooks are the *only* path by which subscription state changes, which puts
 * three obligations on this class:
 *
 *  - **Authenticity.** Nothing is trusted until the adapter has verified the
 *    signature over the raw bytes. That check also bounds the timestamp, so a
 *    captured request cannot be replayed later.
 *  - **Idempotency.** Providers deliver at least once. The ledger claim below
 *    is a unique insert, so a redelivered event is skipped rather than applied
 *    twice — no duplicate invoices, no second phone number purchased.
 *  - **Honest acknowledgement.** A 2xx tells the provider to stop retrying, so
 *    it is only returned once the change is durably stored. Anything else
 *    propagates and the controller answers 5xx, letting the provider's own
 *    backoff retry the delivery.
 */
@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    @Inject(BILLING_PROVIDER) private readonly provider: BillingProvider,
    private readonly billing: BillingService,
    private readonly ledger: WebhookEventRepository,
  ) {}

  /**
   * Verify and process one delivery.
   *
   * Throws on an unverifiable payload — the caller turns that into a 400, which
   * providers treat as permanent and do not retry. That is deliberate: a bad
   * signature will not become good on the third attempt, and retrying it would
   * just amplify a probe.
   */
  async handle(request: WebhookRequest): Promise<WebhookOutcome> {
    // Throws on a bad signature or an out-of-window timestamp. Nothing below
    // this line runs on unverified input.
    const event = await this.provider.verifyAndParseWebhook(request);

    const claim = await this.ledger.claim({
      provider: event.provider,
      providerEventId: event.id,
      eventType: event.type,
      occurredAt: event.occurredAt,
    });

    if (!claim.claimed && claim.reason === 'duplicate') {
      return { ok: true, duplicate: true, eventType: event.type };
    }

    if (!claim.claimed) {
      this.logger.warn(
        `Retrying ${event.provider} webhook ${event.id} (${event.type}), attempt ${claim.attempts}.`,
      );
    }

    try {
      const applied = await this.apply(event);
      await this.ledger.markProcessed(
        event.provider,
        event.id,
        applied ? WebhookEventStatus.PROCESSED : WebhookEventStatus.IGNORED,
      );
      this.logger.log(`Processed ${event.provider} event ${event.type} (${event.id})`);
      return { ok: true, duplicate: false, eventType: event.type };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Recorded before rethrowing so a delivery the provider eventually gives
      // up on is visible in the ledger rather than lost.
      await this.ledger.markFailed(event.provider, event.id, message);
      this.logger.error(`Failed to process ${event.type} (${event.id}): ${message}`);
      throw error;
    }
  }

  /**
   * Apply a verified event. Returns false when nothing was actionable, which
   * is recorded as IGNORED rather than treated as a failure — an unrecognized
   * event is not an error, and answering 5xx would make the provider redeliver
   * it forever.
   */
  private async apply(event: ProviderWebhookEvent): Promise<boolean> {
    if (event.ignored) {
      this.logger.debug(`Ignoring unhandled ${event.provider} event ${event.type}`);
      return false;
    }

    let actionable = false;

    if (event.subscription) {
      // A subscription reference carrying no status of its own (Stripe's
      // checkout.session.completed, for instance) is a pointer, not a payload:
      // re-read live state rather than storing the placeholder over real data.
      if (event.subscription.status === SubscriptionStatus.NONE) {
        await this.billing.refreshSubscription(event.subscription.providerSubscriptionId);
      } else {
        await this.billing.applySubscription(event.subscription);
      }
      actionable = true;
    }

    if (event.invoice) {
      await this.billing.applyInvoice(event.invoice);

      // A payment event is also the earliest reliable signal that a first
      // charge settled, and it can arrive before the subscription event does.
      // Re-reading the subscription here means activation is never waiting on a
      // delivery that may be reordered or delayed.
      if (event.invoice.providerSubscriptionId && !event.subscription) {
        await this.billing.refreshSubscription(event.invoice.providerSubscriptionId);
      }
      actionable = true;
    }

    return actionable;
  }
}
