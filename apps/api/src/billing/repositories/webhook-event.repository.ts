import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WebhookEventStatus } from '@prisma/client';
import type { PaymentProvider } from '@rooferslabs/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** What the ledger says should happen to an inbound delivery. */
export type ClaimOutcome =
  /** First time we have seen this event: process it. */
  | { claimed: true }
  /** Already handled successfully: acknowledge without doing the work again. */
  | { claimed: false; reason: 'duplicate' }
  /** A previous attempt failed or died mid-flight: retry it. */
  | { claimed: false; reason: 'retry'; attempts: number };

/**
 * The webhook ledger — how this system makes at-least-once delivery safe.
 *
 * Payment providers guarantee that an event arrives *at least* once: they retry
 * after a timeout, a 5xx, or a dropped connection, and they can fan the same
 * event out twice. Handling one twice would mean a duplicate invoice row, a
 * second phone number purchased, or a subscription resurrected after
 * cancellation.
 *
 * The defence is a unique constraint, not a check-then-act. {@link claim}
 * *inserts* the provider's event id and lets the database reject the second
 * writer. Two concurrent deliveries of the same event therefore cannot both
 * proceed, however closely they race — something a `findFirst` followed by a
 * `create` could never guarantee.
 */
@Injectable()
export class WebhookEventRepository {
  private readonly logger = new Logger(WebhookEventRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attempt to take ownership of an event.
   *
   * Returns `claimed: true` exactly once per event under normal operation. A
   * delivery whose previous attempt failed — or crashed while still marked
   * PROCESSING — is handed back for retry, because the alternative is losing a
   * subscription state change permanently.
   */
  async claim(input: {
    provider: PaymentProvider;
    providerEventId: string;
    eventType: string;
    occurredAt: Date;
  }): Promise<ClaimOutcome> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          status: WebhookEventStatus.PROCESSING,
        },
      });
      return { claimed: true };
    } catch (error) {
      // P2002 is the unique-constraint violation, i.e. someone got here first.
      // Anything else is a real database problem and must not be swallowed as
      // "already processed" — that would silently drop the event.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: input.providerEventId,
        },
      },
    });

    // Vanished between the failed insert and this read — treat as a retry
    // rather than a duplicate, so the event is still handled.
    if (!existing) return { claimed: false, reason: 'retry', attempts: 1 };

    if (
      existing.status === WebhookEventStatus.PROCESSED ||
      existing.status === WebhookEventStatus.IGNORED
    ) {
      this.logger.debug(
        `Duplicate ${input.provider} webhook ${input.providerEventId} (${input.eventType}) — already handled.`,
      );
      return { claimed: false, reason: 'duplicate' };
    }

    // FAILED, or PROCESSING left behind by a process that died mid-handler.
    const updated = await this.prisma.webhookEvent.update({
      where: { id: existing.id },
      data: { attempts: { increment: 1 }, status: WebhookEventStatus.PROCESSING, error: null },
    });
    return { claimed: false, reason: 'retry', attempts: updated.attempts };
  }

  async markProcessed(
    provider: PaymentProvider,
    providerEventId: string,
    // Only the two terminal success states — a caller cannot mark an event
    // PROCESSED and FAILED through the same door.
    status: Extract<WebhookEventStatus, 'PROCESSED' | 'IGNORED'>,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { provider_providerEventId: { provider, providerEventId } },
      data: { status, processedAt: new Date(), error: null },
    });
  }

  /**
   * Record a failure and keep the attempt count.
   *
   * The row is deliberately left behind: a delivery the provider eventually
   * gives up on is then visible as a FAILED row rather than as nothing at all.
   */
  async markFailed(
    provider: PaymentProvider,
    providerEventId: string,
    error: string,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { provider_providerEventId: { provider, providerEventId } },
      // Truncated: a provider error can carry a very long body, and this column
      // is for triage rather than forensics.
      data: { status: WebhookEventStatus.FAILED, error: error.slice(0, 1000) },
    });
  }
}
