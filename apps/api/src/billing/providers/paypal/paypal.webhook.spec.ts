import { ExternalServiceError } from '../../../common/exceptions/domain.exception';
import type { AppConfigService } from '../../../config/app-config.service';
import type { BillingCatalogRepository } from '../../provisioning/billing-catalog.repository';
import type { PayPalClient } from './paypal.client';
import { PayPalWebhookVerifier, WebhookVerificationError } from './paypal.webhook';

const HEADERS = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1',
  'paypal-transmission-id': 'b1e4b0f0-0000-11f0-0000-000000000000',
  'paypal-transmission-sig': 'signature-bytes',
  'paypal-transmission-time': '2026-08-01T10:00:00Z',
};

const EVENT = {
  id: 'WH-1EX00000000000000-2X000000000000000',
  event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
  create_time: '2026-08-01T10:00:00Z',
  resource: { id: 'I-BW452GLLEP1G', status: 'ACTIVE' },
};

function makeVerifier(
  options: {
    verdict?: unknown;
    throws?: Error;
    /** The configured override. Empty means "fall back to the provisioned one". */
    webhookId?: string;
    /** What the provisioned catalogue holds, if anything. */
    provisionedWebhookId?: string | null;
  } = {},
) {
  const request = options.throws
    ? jest.fn().mockRejectedValue(options.throws)
    : jest.fn().mockResolvedValue(options.verdict ?? { verification_status: 'SUCCESS' });

  const client = {
    request,
    wrap: (error: unknown, action: string) =>
      new ExternalServiceError(`Could not ${action}. Please try again.`),
  } as unknown as PayPalClient;

  const config = {
    paypal: {
      webhookId: options.webhookId ?? '8PT597110X687430LKGECATA',
      environment: 'sandbox',
    },
  } as unknown as AppConfigService;

  const find = jest
    .fn()
    .mockResolvedValue(
      options.provisionedWebhookId
        ? { externalId: options.provisionedWebhookId }
        : options.provisionedWebhookId === null
          ? null
          : { externalId: 'PROVISIONED-WEBHOOK-ID' },
    );
  const catalog = { find } as unknown as BillingCatalogRepository;

  return { verifier: new PayPalWebhookVerifier(client, config, catalog), request, find };
}

const body = (payload: unknown = EVENT) => ({
  rawBody: Buffer.from(JSON.stringify(payload)),
  headers: { ...HEADERS },
});

describe('PayPalWebhookVerifier', () => {
  it('returns the event once PayPal confirms the signature', async () => {
    const { verifier } = makeVerifier();
    await expect(verifier.verify(body())).resolves.toMatchObject({
      id: EVENT.id,
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    });
  });

  it('asks PayPal using the transmission headers exactly as received', async () => {
    const { verifier, request } = makeVerifier();
    await verifier.verify(body());

    expect(request).toHaveBeenCalledWith(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      expect.objectContaining({
        auth_algo: HEADERS['paypal-auth-algo'],
        cert_url: HEADERS['paypal-cert-url'],
        transmission_id: HEADERS['paypal-transmission-id'],
        transmission_sig: HEADERS['paypal-transmission-sig'],
        transmission_time: HEADERS['paypal-transmission-time'],
        webhook_id: '8PT597110X687430LKGECATA',
      }),
    );
  });

  it('rejects a payload PayPal will not vouch for', async () => {
    const { verifier } = makeVerifier({ verdict: { verification_status: 'FAILURE' } });
    await expect(verifier.verify(body())).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  /**
   * The distinction the whole design turns on. PayPal verification is an
   * outbound API call, so "forged" and "PayPal had a bad minute" are different
   * outcomes: the first is permanent and earns a 400, the second is transient
   * and must be retried. Conflating them would eventually discard a real
   * subscription change during an outage.
   */
  it('does not treat a failed verification CALL as a failed signature', async () => {
    const { verifier } = makeVerifier({ throws: new Error('socket hang up') });
    const error = await verifier.verify(body()).catch((e: unknown) => e);

    expect(error).not.toBeInstanceOf(WebhookVerificationError);
    expect(error).toBeInstanceOf(ExternalServiceError);
  });

  it.each(Object.keys(HEADERS))('refuses a delivery missing %s', async (header) => {
    const { verifier, request } = makeVerifier();
    const headers: Record<string, string | undefined> = { ...HEADERS };
    delete headers[header];

    await expect(
      verifier.verify({ rawBody: Buffer.from(JSON.stringify(EVENT)), headers }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
    // Nothing is asked of PayPal for a request that cannot possibly verify.
    expect(request).not.toHaveBeenCalled();
  });

  it('names every missing header at once rather than one per round trip', async () => {
    const { verifier } = makeVerifier();
    const error: unknown = await verifier
      .verify({ rawBody: Buffer.from('{}'), headers: {} })
      .catch((e: unknown) => e);

    expect((error as Error).message).toContain('paypal-auth-algo');
    expect((error as Error).message).toContain('paypal-transmission-sig');
  });

  it('refuses a body that is not JSON', async () => {
    const { verifier } = makeVerifier();
    await expect(
      verifier.verify({ rawBody: Buffer.from('<html>404</html>'), headers: { ...HEADERS } }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  /**
   * The environment variable is optional now that setup registers the webhook,
   * so an empty one must fall through to the provisioned id rather than failing.
   */
  it('falls back to the provisioned webhook id when none is configured', async () => {
    const { verifier, request } = makeVerifier({ webhookId: '' });
    await expect(verifier.verify(body())).resolves.toMatchObject({ id: EVENT.id });
    expect(request).toHaveBeenCalledWith(
      'POST',
      expect.any(String),
      expect.objectContaining({ webhook_id: 'PROVISIONED-WEBHOOK-ID' }),
    );
  });

  it('prefers an explicitly configured id over the provisioned one', async () => {
    const { verifier, request, find } = makeVerifier({ webhookId: 'MANUAL-WEBHOOK-ID' });
    await verifier.verify(body());
    expect(request).toHaveBeenCalledWith(
      'POST',
      expect.any(String),
      expect.objectContaining({ webhook_id: 'MANUAL-WEBHOOK-ID' }),
    );
    // The catalogue is not even consulted when an override exists.
    expect(find).not.toHaveBeenCalled();
  });

  it('refuses to verify at all when no webhook exists anywhere', async () => {
    const { verifier, request } = makeVerifier({ webhookId: '', provisionedWebhookId: null });
    await expect(verifier.verify(body())).rejects.toBeInstanceOf(ExternalServiceError);
    expect(request).not.toHaveBeenCalled();
  });

  it('normalizes a header Node handed over as an array', async () => {
    const { verifier, request } = makeVerifier();
    await verifier.verify({
      rawBody: Buffer.from(JSON.stringify(EVENT)),
      headers: { ...HEADERS, 'paypal-transmission-sig': ['first-sig', 'second-sig'] },
    });

    expect(request).toHaveBeenCalledWith(
      'POST',
      expect.any(String),
      expect.objectContaining({ transmission_sig: 'first-sig' }),
    );
  });
});
