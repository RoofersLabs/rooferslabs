/**
 * The PayPal transport.
 *
 * Wraps the official `@paypal/paypal-server-sdk` client so the rest of the
 * adapter never constructs it, never sees a credential, and never decides which
 * host to talk to. The SDK owns what it is genuinely good at: minting and
 * refreshing the OAuth2 client-credentials token, retrying, and resolving the
 * sandbox/live base URL.
 *
 * ## Why there is a raw `request` helper alongside the typed controllers
 *
 * The SDK's models are generated, and two things we depend on are missing from
 * them:
 *
 *  1. **`Subscription.status`.** PayPal's API returns it on every subscription
 *     read; the generated schema does not model it, and APIMATIC's `object()`
 *     mapper *drops unmodelled keys* rather than passing them through. Reading a
 *     subscription through `SubscriptionsController` therefore yields an object
 *     with no status at all — the single field every state transition in this
 *     integration turns on. (Same for `status_update_time`.)
 *  2. **Webhook signature verification.** `/v1/notifications/verify-webhook-signature`
 *     has no controller in the SDK whatsoever.
 *
 * So reads and verification go through {@link PayPalClient.request}, which is
 * still the SDK's own authenticated request builder — same token, same retries,
 * same base URL — but returns the untouched JSON. Writes, where we only need the
 * id back, use the typed controller.
 *
 * This is the only file in the application that imports the PayPal SDK.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Client, Environment, SubscriptionsController } from '@paypal/paypal-server-sdk';
import {
  BillingProviderUnconfiguredError,
  ExternalServiceError,
} from '../../../common/exceptions/domain.exception';
import { AppConfigService } from '../../../config/app-config.service';

/** An HTTP verb the raw helper accepts. Matches the SDK's own union. */
type Method = 'GET' | 'POST' | 'PATCH';

@Injectable()
export class PayPalClient {
  private readonly logger = new Logger(PayPalClient.name);
  private instance: Client | null = null;
  private controller: SubscriptionsController | null = null;

  constructor(private readonly config: AppConfigService) {}

  /** Whether credentials exist. False means unconfigured, not disabled. */
  get isConfigured(): boolean {
    const { clientId, clientSecret } = this.config.paypal;
    return Boolean(clientId && clientSecret);
  }

  /** True when this process is pointed at real money. */
  get isLive(): boolean {
    return this.config.paypal.environment === 'live';
  }

  /**
   * The SDK client, constructed on first use.
   *
   * Lazy so the process boots without billing credentials — a developer running
   * the app locally should not need a PayPal account to sign in. Cached because
   * it holds the OAuth token and its refresh timer.
   */
  private get client(): Client {
    if (!this.isConfigured) {
      throw new BillingProviderUnconfiguredError(
        'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable billing.',
      );
    }
    this.instance ??= new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: this.config.paypal.clientId,
        oAuthClientSecret: this.config.paypal.clientSecret,
      },
      environment: this.isLive ? Environment.Production : Environment.Sandbox,
      timeout: 20_000,
    });
    return this.instance;
  }

  /** The generated controller, for calls whose response we do not read deeply. */
  get subscriptions(): SubscriptionsController {
    this.controller ??= new SubscriptionsController(this.client);
    return this.controller;
  }

  /**
   * Call a PayPal REST endpoint and return its JSON exactly as sent.
   *
   * Authenticated and retried by the SDK; parsed here rather than by a
   * generated schema, so no field is silently discarded. The caller is
   * responsible for narrowing the result — see `paypal.types.ts`.
   *
   * `headers` carries `PayPal-Request-Id` on write operations. PayPal stores
   * those keys for 72 hours and replays the original response for a repeat, so
   * a retried create returns the object it made the first time rather than a
   * second one. Every write in the provisioner sends one.
   */
  async request<T>(
    method: Method,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const req = this.client.getRequestBuilderFactory()(method, path);
    req.baseUrl('default');
    // An array: the SDK models auth as an OR of AND-clauses, and this is the
    // single-scheme case. Same call its generated controllers make.
    req.authenticate([{ oauth2: true }]);
    req.acceptJson();
    if (headers) req.headers(headers);
    if (body !== undefined) req.json(body);

    const { result } = await req.callAsText();
    // 204s and other empty bodies are legitimate (suspend, cancel, activate).
    return (result ? (JSON.parse(result) as T) : (undefined as T)) as T;
  }

  /**
   * Prove the credentials work and the account can actually sell.
   *
   * Two distinct failures hide behind "billing is broken", and they need
   * different fixes, so they are reported separately: credentials that will not
   * mint a token at all, and credentials that authenticate but lack the
   * permissions this integration needs. Listing the catalogue is the cheapest
   * call that exercises the second — it reads nothing sensitive, creates
   * nothing, and fails the same way a missing scope would.
   */
  async verifyAccess(): Promise<
    { ok: true } | { ok: false; stage: 'auth' | 'scope'; detail: string }
  > {
    try {
      await this.client.clientCredentialsAuthManager.fetchToken();
    } catch (error) {
      return { ok: false, stage: 'auth', detail: describe(error) };
    }

    try {
      await this.request('GET', '/v1/catalogs/products?page_size=1');
      return { ok: true };
    } catch (error) {
      return { ok: false, stage: 'scope', detail: describe(error) };
    }
  }

  /**
   * Convert an SDK or transport failure into a domain error.
   *
   * PayPal's message is logged for triage but never returned to the client: its
   * error bodies name plan ids, merchant account details and internal debug
   * ids that a tenant has no business seeing.
   */
  wrap(error: unknown, action: string): Error {
    this.logger.error(`PayPal failed to ${action}: ${describe(error)}`);
    return new ExternalServiceError(`Could not ${action}. Please try again.`);
  }
}

/**
 * A failure rendered for a log line or an operator's terminal.
 *
 * The SDK's `ApiError` carries the status and the response body, and both are
 * what make a PayPal failure diagnosable — `INVALID_RESOURCE_ID` versus
 * `NOT_AUTHORIZED` is the difference between "run setup" and "your app lacks a
 * permission". Never returned to a customer; only logged, or printed by the
 * setup command to the person who ran it.
 */
export function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const status = (error as { statusCode?: number }).statusCode;
  const body = (error as { body?: unknown }).body;
  const detail =
    typeof body === 'string' ? body.slice(0, 500) : body ? JSON.stringify(body).slice(0, 500) : '';
  return [status ? `HTTP ${status}` : '', error.message, detail].filter(Boolean).join(' — ');
}
