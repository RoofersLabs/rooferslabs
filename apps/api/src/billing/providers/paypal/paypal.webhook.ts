/**
 * PayPal webhook verification.
 *
 * PayPal does not sign with a shared secret the way most processors do. A
 * delivery carries a signature made with a PayPal-held certificate, and the only
 * supported way to check it is to hand the transmission headers and the raw body
 * back to PayPal and ask. That is an outbound API call on the inbound path,
 * which is unusual enough to be worth stating plainly.
 *
 * Two consequences follow, and both are deliberate:
 *
 *  - **Verification can fail for transport reasons.** A network blip is not a
 *    forged payload, so those two outcomes must not be conflated: a failed
 *    *verdict* is permanent and gets a 400, a failed *call* is transient and
 *    must be retried. `WebhookVerificationError` marks only the former.
 *  - **The body must be forwarded exactly as received.** PayPal recomputes the
 *    signature over the original bytes; re-serializing a parsed object changes
 *    key order and whitespace and fails every time.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@rooferslabs/shared';
import { ExternalServiceError } from '../../../common/exceptions/domain.exception';
import { AppConfigService } from '../../../config/app-config.service';
import { BillingCatalogRepository } from '../../provisioning/billing-catalog.repository';
import { WEBHOOK_CATALOG_KEY } from '../../provisioning/catalog.config';
import type { WebhookRequest } from '../../types/billing.types';
import { PayPalClient } from './paypal.client';
import type { PayPalVerificationResult, PayPalWebhookEvent } from './paypal.types';

/**
 * A payload that provably did not come from PayPal.
 *
 * Distinct from {@link ExternalServiceError} so the controller can answer 400
 * (stop retrying — these bytes will never verify) rather than 5xx (try again).
 */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/** The headers PayPal signs over. All five are required; a missing one is fatal. */
const REQUIRED_HEADERS = [
  'paypal-auth-algo',
  'paypal-cert-url',
  'paypal-transmission-id',
  'paypal-transmission-sig',
  'paypal-transmission-time',
] as const;

@Injectable()
export class PayPalWebhookVerifier {
  private readonly logger = new Logger(PayPalWebhookVerifier.name);

  /** The provisioned webhook id, cached for the process's lifetime. */
  private cachedWebhookId: string | null = null;

  constructor(
    private readonly client: PayPalClient,
    private readonly config: AppConfigService,
    private readonly catalog: BillingCatalogRepository,
  ) {}

  /**
   * The webhook whose signature PayPal should check a delivery against.
   *
   * An explicitly configured `PAYPAL_WEBHOOK_ID` wins, so a webhook registered
   * by hand is always honoured. Otherwise the one `billing:paypal:setup`
   * registered and persisted — which is the normal case, and the reason the
   * environment variable is optional.
   *
   * Cached after the first successful resolution: the id is immutable for the
   * lifetime of a registration, and a database read per inbound webhook would be
   * a needless dependency on the hot path of the one thing that must never fail.
   */
  private async resolveWebhookId(): Promise<string | null> {
    if (this.config.paypal.webhookId) return this.config.paypal.webhookId;
    if (this.cachedWebhookId) return this.cachedWebhookId;

    const entry = await this.catalog.find(
      { provider: PaymentProvider.PAYPAL, environment: this.config.paypal.environment },
      WEBHOOK_CATALOG_KEY,
    );
    this.cachedWebhookId = entry?.externalId ?? null;
    return this.cachedWebhookId;
  }

  /**
   * Verify a delivery and return the event it carries.
   *
   * Returning normally is an assertion that PayPal itself confirmed the
   * signature. Every other path throws.
   */
  async verify(request: WebhookRequest): Promise<PayPalWebhookEvent> {
    const webhookId = await this.resolveWebhookId();
    if (!webhookId) {
      throw new ExternalServiceError(
        'No PayPal webhook is registered for this environment, so deliveries cannot be verified. ' +
          'Run `npm run billing:paypal:setup`.',
      );
    }

    const headers = this.readHeaders(request.headers);

    // Parsed only to be re-emitted as `webhook_event`. PayPal's verification
    // endpoint wants the event as JSON, not as a string, and compares against
    // the transmission it recorded — so this parse is for the API's benefit,
    // not a shortcut around the raw bytes.
    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(request.rawBody.toString('utf8')) as PayPalWebhookEvent;
    } catch {
      throw new WebhookVerificationError('PayPal webhook payload is not valid JSON.');
    }

    let verdict: PayPalVerificationResult;
    try {
      verdict = await this.client.request<PayPalVerificationResult>(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: event,
        },
      );
    } catch (error) {
      // The call itself failed. Nothing has been proven either way, so this must
      // stay transient — answering 400 here would discard a genuine event
      // because PayPal's own API had a bad minute.
      throw this.client.wrap(error, 'verify the webhook signature');
    }

    if (verdict?.verification_status !== 'SUCCESS') {
      throw new WebhookVerificationError(
        `PayPal rejected the webhook signature for event ${event.id ?? '<unknown>'}.`,
      );
    }

    this.logger.debug(`Verified PayPal webhook ${event.id} (${event.event_type}).`);
    return event;
  }

  /** Pull the five transmission headers, normalizing Node's array-or-string. */
  private readHeaders(
    raw: Record<string, string | string[] | undefined>,
  ): Record<(typeof REQUIRED_HEADERS)[number], string> {
    const result = {} as Record<(typeof REQUIRED_HEADERS)[number], string>;
    const missing: string[] = [];

    for (const name of REQUIRED_HEADERS) {
      const value = raw[name];
      const single = Array.isArray(value) ? value[0] : value;
      if (!single) {
        missing.push(name);
      } else {
        result[name] = single;
      }
    }

    if (missing.length > 0) {
      throw new WebhookVerificationError(
        `Missing PayPal transmission header(s): ${missing.join(', ')}.`,
      );
    }
    return result;
  }
}
