import { Injectable, Logger } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';

export interface PushPayload {
  title: string;
  message: string;
  /** In-app path to open when the notification is clicked (e.g. /conversations/x). */
  url?: string;
  priority?: string;
}

export interface SaveSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}

/**
 * Web Push delivery for the PWA. Disabled (no-op) until VAPID keys are
 * configured — generate a pair with `npx web-push generate-vapid-keys` and set
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Stale browser subscriptions are pruned
 * automatically when the push service reports them gone (404/410).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {
    const { vapidPublicKey, vapidPrivateKey, vapidSubject } = this.config.push;
    this.enabled = Boolean(vapidPublicKey && vapidPrivateKey);
    if (this.enabled) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } else {
      this.logger.log('VAPID keys not set — Web Push is disabled (in-app notifications only).');
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get publicKey(): string | null {
    return this.enabled ? this.config.push.vapidPublicKey : null;
  }

  /** Register (or refresh) a browser subscription for an operator. */
  async saveSubscription(
    companyId: string,
    userId: string,
    input: SaveSubscriptionInput,
  ): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        companyId,
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
      create: {
        companyId,
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  /** Remove a subscription (browser opted out or permission revoked). */
  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Push a payload to every subscribed device of a company's operators.
   * Best-effort: delivery failures are logged, dead endpoints are pruned.
   */
  async sendToCompany(companyId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { companyId },
    });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: subscription.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(`Push delivery failed (${statusCode ?? 'unknown'}).`);
          }
        }
      }),
    );
  }
}
