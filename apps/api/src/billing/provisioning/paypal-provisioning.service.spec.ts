/**
 * The provisioner's contract is idempotence.
 *
 * These tests are almost entirely about *not* creating things: the whole value
 * of the setup command is that running it twice, or against an account someone
 * already set up by hand, converges rather than duplicating. A duplicate plan is
 * not a cosmetic problem — it is two prices for the same product, and a customer
 * eventually gets charged the wrong one.
 */
import { BillingInterval, SubscriptionPlan } from '@rooferslabs/shared';
import type { AppConfigService } from '../../config/app-config.service';
import type { PayPalCatalog } from '../providers/paypal/paypal.catalog';
import type { PayPalClient } from '../providers/paypal/paypal.client';
import type { PayPalWebhooksAdmin } from '../providers/paypal/paypal.webhooks-admin';
import type { BillingCatalogRepository } from './billing-catalog.repository';
import {
  PayPalProvisioningService,
  type ProvisionReport,
  type ProvisionStep,
} from './paypal-provisioning.service';

const PRODUCT_ID = 'RL-R1-ECHO-SBX';
const PLAN_ID = 'P-5ML4271244454362WXNWU5NQ';
const WEBHOOK_ID = '8PT597110X687430LKGECATA';
const PLAN_KEY = `plan:${SubscriptionPlan.STARTER}:${BillingInterval.MONTH}`;
/** The token-priced twin. A separate PayPal plan, never an edit to the real one. */
const TEST_PLAN_KEY = `${PLAN_KEY}:test`;
const TEST_PLAN_ID = 'P-TEST0000000000000000000';

function makeService(
  options: {
    /** Rows already in billing_catalog, by key. */
    stored?: Record<string, { externalId: string; fingerprint?: string }>;
    /** Products that exist at PayPal, by id. */
    products?: Record<string, { id: string; name: string }>;
    productByName?: { id: string; name: string } | null;
    plans?: { id: string; name: string; status?: string; billing_cycles?: unknown[] }[];
    webhook?: { id: string; url: string; event_types?: { name: string }[] } | null;
    accessOk?: boolean;
    publicUrl?: string;
    configuredWebhookId?: string;
  } = {},
) {
  const client = {
    isConfigured: true,
    verifyAccess: jest
      .fn()
      .mockResolvedValue(
        options.accessOk === false
          ? { ok: false, stage: 'auth', detail: 'bad creds' }
          : { ok: true },
      ),
  } as unknown as PayPalClient;

  const products = options.products ?? {};
  const createProduct = jest
    .fn()
    .mockImplementation(({ id, name }: { id: string; name: string }) =>
      Promise.resolve({ id, name }),
    );
  // Distinct ids per plan, so a test can tell which of the two was created.
  const createPlan = jest
    .fn()
    .mockImplementation(({ name, amount }: { name: string; amount: string }) =>
      Promise.resolve({ id: amount === '1.00' ? TEST_PLAN_ID : PLAN_ID, name }),
    );

  const catalog = {
    getProduct: jest.fn().mockImplementation((id: string) => Promise.resolve(products[id] ?? null)),
    findProductByName: jest.fn().mockResolvedValue(options.productByName ?? null),
    createProduct,
    getPlan: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve((options.plans ?? []).find((plan) => plan.id === id) ?? null),
      ),
    listPlans: jest.fn().mockResolvedValue(options.plans ?? []),
    createPlan,
    planMatches: jest.fn().mockReturnValue(true),
  } as unknown as PayPalCatalog;

  const replaceEventTypes = jest.fn().mockResolvedValue({ id: WEBHOOK_ID });
  const createWebhook = jest.fn().mockResolvedValue({ id: WEBHOOK_ID, url: 'https://x' });
  const webhooks = {
    findByUrl: jest.fn().mockResolvedValue(options.webhook ?? null),
    create: createWebhook,
    replaceEventTypes,
    diffEventTypes: jest
      .fn()
      .mockImplementation((webhook: { event_types?: { name: string }[] }, wanted: string[]) => {
        const current = new Set((webhook.event_types ?? []).map((e) => e.name));
        const missing = wanted.filter((name) => !current.has(name));
        return { missing, extra: [], matches: missing.length === 0 };
      }),
  } as unknown as PayPalWebhooksAdmin;

  const stored = options.stored ?? {};
  const upsert = jest.fn().mockResolvedValue({});
  const repo = {
    find: jest
      .fn()
      .mockImplementation((_scope, key: string) => Promise.resolve(stored[key] ?? null)),
    findAll: jest.fn().mockResolvedValue([]),
    upsert,
  } as unknown as BillingCatalogRepository;

  const config = {
    paypal: {
      environment: 'sandbox',
      webhookId: options.configuredWebhookId ?? '',
    },
    api: { publicUrl: options.publicUrl ?? 'https://api.example.com' },
  } as unknown as AppConfigService;

  return {
    service: new PayPalProvisioningService(client, catalog, webhooks, repo, config),
    catalog,
    createProduct,
    createPlan,
    createWebhook,
    replaceEventTypes,
    upsert,
    client,
  };
}

const step = (report: ProvisionReport, key: string): ProvisionStep | undefined =>
  report.steps.find((s) => s.key === key);

describe('PayPalProvisioningService — first run', () => {
  it('creates the product, the plan and the webhook, and records all three', async () => {
    const { service, createProduct, createPlan, createWebhook, upsert } = makeService();

    const report = await service.provision();

    expect(report.ok).toBe(true);
    expect(createProduct).toHaveBeenCalledTimes(1);
    // Both the published plan and its token-priced twin, so the pricing flag is
    // a pure configuration switch with nothing to provision first.
    expect(createPlan).toHaveBeenCalledTimes(2);
    expect(createWebhook).toHaveBeenCalledTimes(1);

    expect(step(report, 'product')?.action).toBe('created');
    expect(step(report, PLAN_KEY)?.action).toBe('created');
    expect(step(report, TEST_PLAN_KEY)?.action).toBe('created');
    expect(step(report, 'webhook')?.action).toBe('created');

    // Every created object is persisted, or the next run would make it again.
    const keys = upsert.mock.calls.map(([, entry]) => (entry as { key: string }).key);
    expect(keys).toEqual(expect.arrayContaining(['product', PLAN_KEY, TEST_PLAN_KEY, 'webhook']));
  });

  it('creates the plan against the product it just made', async () => {
    const { service, createPlan } = makeService();
    await service.provision();
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ productId: expect.stringContaining('RL-') }),
    );
  });

  it('sends an idempotency key on every create', async () => {
    const { service, createPlan } = makeService();
    await service.provision();
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: expect.stringContaining(PLAN_KEY) }),
    );
  });

  /**
   * The two plans must be genuinely separate objects at PayPal even while their
   * prices coincide at launch. PayPal cannot reprice a plan with live
   * subscriptions, so "make a test price" can only ever mean "make another
   * plan" — never an edit to the published one — and when the launch price
   * rises the pairing is what keeps a $1 pipeline check possible.
   */
  it('creates the test plan alongside the published plan', async () => {
    const { service, createPlan } = makeService();
    await service.provision();

    const amounts = createPlan.mock.calls.map(([input]) => (input as { amount: string }).amount);
    expect(amounts.sort()).toEqual(['1.00', '1.00']);

    // And the customer-visible name says which is which — PayPal shows it on
    // the approval page.
    const names = createPlan.mock.calls.map(([input]) => (input as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(['Starter', 'Founding Customer (test pricing)']));
  });
});

describe('PayPalProvisioningService — second run', () => {
  /** The headline property: nothing is created twice. */
  it('creates nothing when everything is already recorded and still exists', async () => {
    const { service, createProduct, createPlan, createWebhook } = makeService({
      stored: {
        product: { externalId: PRODUCT_ID },
        [PLAN_KEY]: { externalId: PLAN_ID },
        [TEST_PLAN_KEY]: { externalId: TEST_PLAN_ID },
        webhook: { externalId: WEBHOOK_ID },
      },
      products: { [PRODUCT_ID]: { id: PRODUCT_ID, name: 'r1 Echo' } },
      plans: [
        { id: PLAN_ID, name: 'Starter' },
        { id: TEST_PLAN_ID, name: 'Founding Customer (test pricing)' },
      ],
      webhook: {
        id: WEBHOOK_ID,
        url: 'https://api.example.com/v1/billing/webhook/paypal',
        event_types: [],
      },
    });

    const report = await service.provision();

    expect(report.ok).toBe(true);
    expect(createProduct).not.toHaveBeenCalled();
    expect(createPlan).not.toHaveBeenCalled();
    expect(createWebhook).not.toHaveBeenCalled();
    expect(step(report, 'product')?.action).toBe('reused');
    expect(step(report, PLAN_KEY)?.action).toBe('reused');
  });

  /**
   * A fresh database against an account that was already provisioned — a
   * restored snapshot, a new environment pointed at the same PayPal app. The
   * objects must be adopted, never duplicated.
   */
  it('adopts existing PayPal objects when the catalogue rows are gone', async () => {
    const { service, createProduct, createPlan, createWebhook, upsert } = makeService({
      products: { [PRODUCT_ID]: { id: PRODUCT_ID, name: 'r1 Echo' } },
      plans: [
        { id: PLAN_ID, name: 'Starter' },
        { id: TEST_PLAN_ID, name: 'Founding Customer (test pricing)' },
      ],
      webhook: {
        id: WEBHOOK_ID,
        url: 'https://api.example.com/v1/billing/webhook/paypal',
        event_types: [],
      },
    });

    const report = await service.provision();

    expect(createProduct).not.toHaveBeenCalled();
    expect(createPlan).not.toHaveBeenCalled();
    expect(createWebhook).not.toHaveBeenCalled();
    expect(step(report, PLAN_KEY)?.externalId).toBe(PLAN_ID);
    expect(step(report, TEST_PLAN_KEY)?.externalId).toBe(TEST_PLAN_ID);
    // Adoption still writes the row, so the next run takes the fast path.
    expect(upsert).toHaveBeenCalled();
  });

  /**
   * Adoption must judge the price on a full plan, not on the list summary.
   *
   * PayPal's plan LIST returns id, name and status but no `billing_cycles`.
   * Comparing against that summary reported drift on every single adoption —
   * "bills an unreadable amount" — which is both false and, worse, inert: a
   * plan that had genuinely drifted looked exactly the same. This is that
   * regression, with the two responses deliberately different.
   */
  it('re-reads the full plan before judging an adopted price', async () => {
    const summary = { id: PLAN_ID, name: 'Starter' }; // no billing_cycles, as PayPal lists it
    const full = {
      id: PLAN_ID,
      name: 'Starter',
      billing_cycles: [
        {
          tenure_type: 'REGULAR',
          pricing_scheme: { fixed_price: { value: '1.0', currency_code: 'USD' } },
        },
      ],
    };

    const { service, catalog } = makeService({ plans: [summary] });
    (catalog.getPlan as jest.Mock).mockResolvedValue(full);

    const report = await service.provision();

    // The comparison saw the priced plan, never the summary.
    expect(catalog.planMatches).toHaveBeenCalledWith(full, expect.anything());
    expect(catalog.planMatches).not.toHaveBeenCalledWith(summary, expect.anything());
    expect(step(report, PLAN_KEY)?.drift).toBeUndefined();
  });

  it('re-provisions when a recorded object has been deleted at PayPal', async () => {
    const { service, createProduct } = makeService({
      stored: { product: { externalId: PRODUCT_ID } },
      products: {}, // the recorded id 404s
    });

    const report = await service.provision();
    expect(createProduct).toHaveBeenCalledTimes(1);
    expect(step(report, 'product')?.action).toBe('created');
  });

  it('ignores an inactive plan of the same name rather than adopting it', async () => {
    const { service, createPlan } = makeService({
      plans: [
        { id: 'P-OLD', name: 'Starter', status: 'INACTIVE' },
        { id: TEST_PLAN_ID, name: 'Founding Customer (test pricing)' },
      ],
    });
    await service.provision();
    // The published plan is re-created; the test plan is adopted.
    expect(createPlan).toHaveBeenCalledTimes(1);
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Starter', amount: '1.00' }),
    );
  });
});

describe('PayPalProvisioningService — webhook reconciliation', () => {
  it('subscribes an existing webhook to events it is missing', async () => {
    const { service, replaceEventTypes } = makeService({
      webhook: {
        id: WEBHOOK_ID,
        url: 'https://api.example.com/v1/billing/webhook/paypal',
        event_types: [{ name: 'PAYMENT.SALE.COMPLETED' }],
      },
    });

    const report = await service.provision();
    expect(replaceEventTypes).toHaveBeenCalledTimes(1);
    expect(step(report, 'webhook')?.action).toBe('updated');
  });

  it('writes nothing when the webhook is already correct', async () => {
    const { service, replaceEventTypes } = makeService({
      webhook: {
        id: WEBHOOK_ID,
        url: 'https://api.example.com/v1/billing/webhook/paypal',
        // diffEventTypes is stubbed to report no missing events for this shape.
        event_types: [],
      },
    });
    // The stub reports every wanted event as missing for an empty list, so make
    // it match instead.
    (service as unknown as { webhooks: { diffEventTypes: jest.Mock } }).webhooks.diffEventTypes =
      jest.fn().mockReturnValue({ missing: [], extra: [], matches: true });

    const report = await service.provision();
    expect(replaceEventTypes).not.toHaveBeenCalled();
    expect(step(report, 'webhook')?.action).toBe('reused');
  });

  /**
   * PayPal will not deliver to localhost, and a developer running setup without
   * a tunnel should get an instruction rather than a 400 from PayPal — and the
   * product and plan should still be created.
   */
  it('skips the webhook on an unreachable URL without failing the run', async () => {
    const { service, createPlan, createWebhook } = makeService({
      publicUrl: 'http://localhost:4000',
    });

    const report = await service.provision();

    expect(report.ok).toBe(true);
    expect(createPlan).toHaveBeenCalledTimes(2);
    expect(createWebhook).not.toHaveBeenCalled();
    expect(step(report, 'webhook')?.action).toBe('skipped');
    expect(step(report, 'webhook')?.detail).toMatch(/tunnel/i);
  });

  it('leaves a hand-registered webhook alone when one is configured', async () => {
    const { service, createWebhook } = makeService({ configuredWebhookId: 'MANUAL-ID' });
    const report = await service.provision();

    expect(createWebhook).not.toHaveBeenCalled();
    expect(step(report, 'webhook')?.externalId).toBe('MANUAL-ID');
  });
});

describe('PayPalProvisioningService — refusals', () => {
  it('stops before touching the catalogue when credentials are rejected', async () => {
    const { service, catalog } = makeService({ accessOk: false });
    const report = await service.provision();

    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatch(/rejected the credentials/i);
    expect(catalog.getProduct).not.toHaveBeenCalled();
  });

  it('stops when no credentials are set at all', async () => {
    const { service, client } = makeService();
    (client as { isConfigured: boolean }).isConfigured = false;

    const report = await service.provision();
    expect(report.ok).toBe(false);
    expect(report.errors[0]).toMatch(/PAYPAL_CLIENT_ID/);
  });

  it('reports drift instead of repricing a live plan', async () => {
    const { service, catalog } = makeService({
      stored: { [PLAN_KEY]: { externalId: PLAN_ID, fingerprint: 'v1:stale' } },
      plans: [
        {
          id: PLAN_ID,
          name: 'Founding Customer',
          billing_cycles: [
            {
              tenure_type: 'REGULAR',
              pricing_scheme: { fixed_price: { value: '39.00', currency_code: 'USD' } },
            },
          ],
        },
      ],
    });
    (catalog.planMatches as jest.Mock).mockReturnValue(false);

    const report = await service.provision();
    const planStep = step(report, PLAN_KEY);

    // Reused, not failed: the plan works, it simply is not what the catalogue
    // now describes, and only a human can decide what to do about that.
    expect(planStep?.action).toBe('reused');
    expect(planStep?.drift).toMatch(/cannot reprice/i);
    expect(report.ok).toBe(true);
  });
});

describe('PayPalProvisioningService — webhook URL', () => {
  it('derives the delivery target from the API origin', () => {
    const { service } = makeService({ publicUrl: 'https://api.rooferslabs.com/' });
    expect(service.webhookUrl).toBe('https://api.rooferslabs.com/v1/billing/webhook/paypal');
  });
});
