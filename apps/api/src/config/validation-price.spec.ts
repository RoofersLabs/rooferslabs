import { BillingInterval, SubscriptionPlan } from '@rooferslabs/shared';
import configuration from './configuration';

/**
 * The validation price: a live price that stands in for the Founding Customer
 * monthly price while the payment pipeline is being proven against the real
 * merchant account.
 *
 * These assert the substitution itself rather than any amount. The amounts live
 * in Paddle — the application never knows what a price id costs, which is
 * exactly why switching back is a configuration change and not a code one.
 */
const FOUNDING = 'pri_founding_49';
const VALIDATION = 'pri_validation_1';

function build(overrides: Record<string, string | undefined> = {}) {
  const saved = process.env;
  process.env = {
    ...saved,
    PADDLE_PRICE_STARTER_MONTHLY: FOUNDING,
    PADDLE_PRICE_PROFESSIONAL_MONTHLY: 'pri_professional',
    PADDLE_PRICE_VALIDATION_MONTHLY: undefined,
    ...overrides,
  } as NodeJS.ProcessEnv;
  try {
    return configuration();
  } finally {
    process.env = saved;
  }
}

const monthly = (config: ReturnType<typeof configuration>) =>
  config.paddle.prices[SubscriptionPlan.STARTER][BillingInterval.MONTH];

describe('validation price substitution', () => {
  it('charges the Founding Customer price when no validation price is set', () => {
    const config = build();

    expect(monthly(config)).toBe(FOUNDING);
    expect(config.paddle.validationPriceId).toBe('');
  });

  it('substitutes the validation price into the plan table', () => {
    const config = build({ PADDLE_PRICE_VALIDATION_MONTHLY: VALIDATION });

    expect(monthly(config)).toBe(VALIDATION);
  });

  it('substitutes into the table both directions of the mapping read', () => {
    // The load-bearing one. `priceIdFor` opens the checkout from this table and
    // `planForPriceId` reads an incoming webhook's price id back off the SAME
    // table to decide which plan was bought. Substituting only at checkout
    // would charge the validation price and then fail to recognise it on the
    // way back, and the subscription would sync with no plan at all.
    const config = build({ PADDLE_PRICE_VALIDATION_MONTHLY: VALIDATION });
    const table = config.paddle.prices;

    const reverse = Object.entries(table).flatMap(([plan, intervals]) =>
      Object.entries(intervals)
        .filter(([, id]) => id === VALIDATION)
        .map(([interval]) => ({ plan, interval })),
    );

    expect(reverse).toEqual([{ plan: SubscriptionPlan.STARTER, interval: BillingInterval.MONTH }]);
  });

  it('still reports the validation price separately, so the divergence can be logged', () => {
    // Folding it into the table alone would leave an ordinary-looking price id
    // and nothing to announce at boot.
    const config = build({ PADDLE_PRICE_VALIDATION_MONTHLY: VALIDATION });

    expect(config.paddle.validationPriceId).toBe(VALIDATION);
  });

  it('treats a blank or whitespace value as not set', () => {
    // A variable left declared but empty by a deploy template must not read as
    // "charge something else".
    expect(monthly(build({ PADDLE_PRICE_VALIDATION_MONTHLY: '' }))).toBe(FOUNDING);
    expect(monthly(build({ PADDLE_PRICE_VALIDATION_MONTHLY: '   ' }))).toBe(FOUNDING);
  });

  it('leaves every other plan and interval alone', () => {
    // The validation price replaces exactly one cell. A professional-plan
    // checkout, or an annual one, must be untouched by it.
    const config = build({ PADDLE_PRICE_VALIDATION_MONTHLY: VALIDATION });

    expect(config.paddle.prices[SubscriptionPlan.PROFESSIONAL][BillingInterval.MONTH]).toBe(
      'pri_professional',
    );
    expect(config.paddle.prices[SubscriptionPlan.STARTER][BillingInterval.YEAR]).not.toBe(
      VALIDATION,
    );
  });

  it('reverts to the Founding Customer price by removing one variable', () => {
    // The deliverable's actual promise: no code changes to go live at the real
    // price, and the id that takes over is the one already configured.
    const validating = build({ PADDLE_PRICE_VALIDATION_MONTHLY: VALIDATION });
    const live = build();

    expect(monthly(validating)).toBe(VALIDATION);
    expect(monthly(live)).toBe(FOUNDING);
  });
});
