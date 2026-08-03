/**
 * The scheduled half of cancel-at-period-end.
 *
 * PayPal has no scheduled cancellation: `cancelAtPeriodEnd` suspends the
 * subscription, which stops billing and keeps it reinstatable, and something has
 * to come along afterwards to make the cancellation real. That is this.
 *
 * It is deliberately the *only* thing in billing that runs on a timer.
 * Everything else is driven by a verified webhook, because a provider telling us
 * what happened is always better evidence than us guessing from a clock. This
 * job is the exception because there is no event to wait for — nothing happens
 * at PayPal when a suspended subscription's paid term quietly expires.
 *
 * ## Why an hourly sweep rather than a per-subscription timer
 *
 * A timer per subscription would be exact but would not survive a restart, and
 * the API runs as more than one task. A sweep is idempotent, recovers from any
 * amount of downtime by simply finding more rows on the next pass, and is
 * correct if it runs late — a tenant keeping access for an extra fifty-nine
 * minutes is a rounding error, and one losing it early is a support ticket.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class SubscriptionSweepService {
  private readonly logger = new Logger(SubscriptionSweepService.name);

  /**
   * Guards against overlap.
   *
   * A pass that runs long — a slow provider, a large backlog — must not have a
   * second one start underneath it and try to cancel the same subscriptions
   * twice. The provider call is not transactional, so this is the only thing
   * preventing that.
   */
  private running = false;

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'finalize-lapsed-cancellations' })
  async sweep(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous cancellation sweep is still running; skipping this pass.');
      return;
    }

    this.running = true;
    try {
      const finalized = await this.billing.finalizeLapsedCancellations();
      if (finalized > 0) {
        this.logger.log(`Finalized ${finalized} lapsed cancellation(s).`);
      }
    } catch (error) {
      // Never rethrow from a scheduled task: an unhandled rejection here takes
      // the process down, and a failed sweep is recoverable by definition — the
      // next pass finds exactly the same rows.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Cancellation sweep failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
