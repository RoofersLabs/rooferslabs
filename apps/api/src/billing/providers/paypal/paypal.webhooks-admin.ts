/**
 * PayPal webhook registration.
 *
 * PayPal exposes webhook management over its API, which is the fact that
 * removes the last piece of dashboard work from setting this integration up:
 * the webhook can be created, found and reconciled from code, and its id — the
 * thing signature verification needs — discovered rather than pasted into an
 * environment variable.
 *
 * Distinct from `paypal.webhook.ts`, which *verifies* inbound deliveries. This
 * file only ever runs from the provisioner.
 *
 * Two PayPal constraints shape the code:
 *
 *  - **HTTPS only, and no localhost.** PayPal refuses to register a webhook it
 *    cannot reach, so local development needs a tunnel. The provisioner checks
 *    the URL before calling rather than surfacing PayPal's opaque rejection.
 *  - **Ten webhooks per app.** Creating one per deploy would exhaust that
 *    quietly, which is why the URL is matched exactly and an existing webhook is
 *    patched rather than replaced.
 */
import { Injectable } from '@nestjs/common';
import { PayPalClient } from './paypal.client';

export interface PayPalWebhook {
  id: string;
  url: string;
  event_types?: { name: string }[];
}

interface WebhookList {
  webhooks?: PayPalWebhook[];
}

@Injectable()
export class PayPalWebhooksAdmin {
  constructor(private readonly client: PayPalClient) {}

  /** Every webhook registered against this REST app. */
  async list(): Promise<PayPalWebhook[]> {
    const result = await this.client.request<WebhookList>('GET', '/v1/notifications/webhooks');
    return result?.webhooks ?? [];
  }

  /**
   * The webhook pointing at this URL, if one is registered.
   *
   * Matched on the URL rather than remembered by id, so a deployment whose
   * catalogue row was lost — a fresh database, a restored snapshot — rediscovers
   * its own webhook instead of registering a second one against the same
   * endpoint and receiving every delivery twice.
   */
  async findByUrl(url: string): Promise<PayPalWebhook | null> {
    const webhooks = await this.list();
    return webhooks.find((webhook) => normalizeUrl(webhook.url) === normalizeUrl(url)) ?? null;
  }

  async create(url: string, eventTypes: readonly string[]): Promise<PayPalWebhook> {
    return this.client.request<PayPalWebhook>(
      'POST',
      '/v1/notifications/webhooks',
      { url, event_types: eventTypes.map((name) => ({ name })) },
      { 'PayPal-Request-Id': `webhook-${normalizeUrl(url)}` },
    );
  }

  /**
   * Bring an existing webhook's event list in line with the catalogue.
   *
   * A JSON Patch replace, because PayPal has no "add these events" operation —
   * the whole list is written. Called only when the sets actually differ, so a
   * re-run of setup against an already-correct webhook makes no write at all.
   */
  async replaceEventTypes(
    webhookId: string,
    eventTypes: readonly string[],
  ): Promise<PayPalWebhook> {
    return this.client.request<PayPalWebhook>(
      'PATCH',
      `/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`,
      [
        {
          op: 'replace',
          path: '/event_types',
          value: eventTypes.map((name) => ({ name })),
        },
      ],
    );
  }

  /**
   * The events this webhook is missing, and the ones it has that we do not want.
   *
   * Both directions matter. Missing events silently drop subscription state
   * changes — the worst failure mode this integration has. Extra events cost a
   * verification round-trip each and are then discarded as ignored, so they are
   * reported too, but they are not an error.
   */
  diffEventTypes(
    webhook: PayPalWebhook,
    wanted: readonly string[],
  ): { missing: string[]; extra: string[]; matches: boolean } {
    const current = new Set((webhook.event_types ?? []).map((event) => event.name));
    const desired = new Set(wanted);

    const missing = wanted.filter((name) => !current.has(name));
    const extra = [...current].filter((name) => !desired.has(name));

    return { missing, extra, matches: missing.length === 0 && extra.length === 0 };
  }

  /**
   * Whether PayPal will accept this URL at all.
   *
   * Checked before calling so the operator gets an instruction ("expose the API
   * with a tunnel") rather than PayPal's generic validation error.
   */
  static validateUrl(url: string): { ok: true } | { ok: false; reason: string } {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: `"${url}" is not a valid URL.` };
    }

    // Locality is checked BEFORE the scheme, deliberately. A developer's API
    // origin is `http://localhost:4000`, which fails both tests — and of the two
    // messages, only this one tells them what to actually do. Reporting "not
    // HTTPS" first would be technically true and practically useless.
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return {
        ok: false,
        reason:
          `PayPal cannot reach ${host}. Expose the API with a tunnel (e.g. \`ngrok http 4000\`) ` +
          `and set API_PUBLIC_URL to the tunnel origin before running setup.`,
      };
    }

    if (parsed.protocol !== 'https:') {
      return {
        ok: false,
        reason: `PayPal only delivers to HTTPS endpoints; this is ${parsed.protocol}//.`,
      };
    }

    return { ok: true };
  }
}

/** Trailing slashes are not a meaningful difference between two webhook URLs. */
function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
