/**
 * Test pricing: charge $1.00, advertise $49.00.
 *
 * The property these tests protect is narrow and load-bearing — the *only*
 * thing the flag may change is which PayPal plan id a checkout is created
 * against. Anything else it touched would be a bug: a subscription bought at
 * test pricing has to be indistinguishable from a real one everywhere above the
 * adapter, or entitlement, webhooks and the billing page would all start
 * disagreeing with each other.
 */
import { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import { ExternalServiceError } from '../../../common/exceptions/domain.exception';
import type { AppConfigService } from '../../../config/app-config.service';
import type { BillingCatalogRepository } from '../../provisioning/billing-catalog.repository';
import { PayPalPlans } from './paypal.plans';

const PRODUCTION_PLAN_ID = 'P-5ML4271244454362WXNWU5NQ';
const TEST_PLAN_ID = 'P-1RN14801Y5581574TXNWU5PA';

const MONTHLY = { plan: SubscriptionPlan.STARTER, interval: BillingInterval.MONTH };
const ANNUAL = { plan: SubscriptionPlan.STARTER, interval: BillingInterval.YEAR };
const PROFESSIONAL = { plan: SubscriptionPlan.PROFESSIONAL, interval: BillingInterval.MONTH };

function makePlans(
  options: { testPricing?: boolean; rows?: { key: string; externalId: string }[] } = {},
) {
  const rows = options.rows ?? [
    { key: 'product', externalId: 'RL-R1-ECHO-SBX' },
    {
      key: `plan:${SubscriptionPlan.STARTER}:${BillingInterval.MONTH}`,
      externalId: PRODUCTION_PLAN_ID,
    },
    {
      key: `plan:${SubscriptionPlan.STARTER}:${BillingInterval.MONTH}:test`,
      externalId: TEST_PLAN_ID,
    },
    { key: 'webhook', externalId: 'WH-1' },
  ];

  const config = {
    paypal: {
      environment: 'sandbox',
      testPricing: options.testPricing ?? false,
    },
  } as unknown as AppConfigService;

  const repo = {
    findAll: jest.fn().mockResolvedValue(rows),
  } as unknown as BillingCatalogRepository;

  return { plans: new PayPalPlans(config, repo), repo };
}

describe('PayPalPlans — pricing mode', () => {
  it('charges the published plan by default', async () => {
    const { plans } = makePlans();
    await plans.refresh();
    await expect(plans.planIdFor(MONTHLY)).resolves.toBe(PRODUCTION_PLAN_ID);
  });

  it('charges the test plan when PAYPAL_TEST_PRICING is on', async () => {
    const { plans } = makePlans({ testPricing: true });
    await plans.refresh();
    await expect(plans.planIdFor(MONTHLY)).resolves.toBe(TEST_PLAN_ID);
  });

  /**
   * The switch has to be genuinely reversible with no code change and no data
   * change — turning the variable off must restore the $49 plan immediately.
   */
  it('restores the published plan the moment the flag is turned off', async () => {
    const on = makePlans({ testPricing: true });
    await on.plans.refresh();
    await expect(on.plans.planIdFor(MONTHLY)).resolves.toBe(TEST_PLAN_ID);

    const off = makePlans({ testPricing: false });
    await off.plans.refresh();
    await expect(off.plans.planIdFor(MONTHLY)).resolves.toBe(PRODUCTION_PLAN_ID);
  });

  /**
   * Blast radius. A forgotten flag should cost one plan's revenue, not the whole
   * catalogue's — so it applies to the Founding Customer monthly plan and
   * nothing else, even when other plans are eventually provisioned.
   */
  it.each([
    ['annual', ANNUAL],
    ['professional', PROFESSIONAL],
  ])('never discounts the %s plan', async (_label, selection) => {
    const { plans } = makePlans({
      testPricing: true,
      rows: [
        { key: `plan:${selection.plan}:${selection.interval}`, externalId: 'P-OTHER' },
        {
          key: `plan:${selection.plan}:${selection.interval}:test`,
          externalId: 'P-OTHER-TEST',
        },
      ],
    });
    await plans.refresh();
    await expect(plans.planIdFor(selection)).resolves.toBe('P-OTHER');
  });

  it('refuses with an actionable message when the test plan is not provisioned', async () => {
    const { plans } = makePlans({
      testPricing: true,
      rows: [
        {
          key: `plan:${SubscriptionPlan.STARTER}:${BillingInterval.MONTH}`,
          externalId: PRODUCTION_PLAN_ID,
        },
      ],
    });
    await plans.refresh();

    // Refusing is right: silently falling back to $49 would charge a customer
    // 49x what the operator intended during a test.
    const error: unknown = await plans.planIdFor(MONTHLY).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as Error).message).toMatch(/PAYPAL_TEST_PRICING/);
  });
});

describe('PayPalPlans — reverse lookup', () => {
  /**
   * The most important property of the whole mechanism. A subscription bought at
   * $1 must resolve to the same domain plan as one bought at $49, or it would
   * sync with no plan and grant no entitlement — the customer would pay and stay
   * locked out.
   */
  it('resolves both plan ids to the same domain plan', async () => {
    const { plans } = makePlans();
    await plans.refresh();

    const expected = { plan: SubscriptionPlan.STARTER, interval: BillingInterval.MONTH };
    expect(plans.planForPlanId(PRODUCTION_PLAN_ID)).toEqual(expected);
    expect(plans.planForPlanId(TEST_PLAN_ID)).toEqual(expected);
  });

  /**
   * Existing test subscribers must not break when the flag is turned off. Their
   * subscriptions still name the $1 plan id, and every future webhook for them
   * has to keep resolving.
   */
  it('still resolves the test plan id after test pricing is disabled', async () => {
    const { plans } = makePlans({ testPricing: false });
    await plans.refresh();
    expect(plans.planForPlanId(TEST_PLAN_ID)).toEqual({
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
    });
  });

  it('returns null for an id from no catalogue at all', async () => {
    const { plans } = makePlans();
    await plans.refresh();
    expect(plans.planForPlanId('P-SOMETHING-ELSE')).toBeNull();
    expect(plans.planForPlanId(null)).toBeNull();
  });

  it('ignores non-plan rows in the catalogue', async () => {
    const { plans } = makePlans();
    await plans.refresh();
    // The product and webhook rows share the table and must never be mistaken
    // for something sellable.
    expect(plans.planForPlanId('RL-R1-ECHO-SBX')).toBeNull();
    expect(plans.planForPlanId('WH-1')).toBeNull();
  });
});

describe('PayPalPlans — catalogue scope', () => {
  it('reads only the active provider and environment', async () => {
    const { plans, repo } = makePlans();
    await plans.refresh();
    expect(repo.findAll).toHaveBeenCalledWith({
      provider: PaymentProvider.PAYPAL,
      environment: 'sandbox',
    });
  });
});
