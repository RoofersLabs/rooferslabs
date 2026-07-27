import { validateEnv } from './env.validation';

/** A production environment with everything except the Stripe credentials. */
const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost:5432/db',
  CLERK_SECRET_KEY: 'sk_test',
  CLERK_PUBLISHABLE_KEY: 'pk_test',
  REDIS_URL: 'redis://localhost:6379',
  API_PUBLIC_URL: 'https://api.example.com',
  WEB_PUBLIC_URL: 'https://example.com',
};

const stripeCredentials = {
  STRIPE_SECRET_KEY: 'sk_live',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  STRIPE_PRICE_STARTER: 'price_starter',
  STRIPE_PRICE_PROFESSIONAL: 'price_pro',
};

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('validateEnv — Stripe requirements', () => {
  it('boots a production API with no Stripe variables when payments are disabled', () => {
    // The whole point of the flag: ship before the Stripe account is approved.
    expect(() => validateEnv({ ...productionBase, PAYMENTS_ENABLED: 'false' })).not.toThrow();
  });

  it('refuses to boot production with payments enabled and Stripe missing', () => {
    // A production boot with the wall on but no Stripe would lock every
    // customer out, so this must stay fatal.
    expect(() => validateEnv({ ...productionBase })).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('names every missing Stripe variable at once', () => {
    expect(() => validateEnv({ ...productionBase })).toThrow(
      /STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL/,
    );
  });

  it('boots production with payments enabled once Stripe is configured', () => {
    expect(() => validateEnv({ ...productionBase, ...stripeCredentials })).not.toThrow();
  });

  it('still enforces the non-Stripe production requirements when payments are off', () => {
    // Disabling billing must not weaken anything else.
    const withoutClerk = { ...productionBase, CLERK_SECRET_KEY: '' };
    expect(() => validateEnv({ ...withoutClerk, PAYMENTS_ENABLED: 'false' })).toThrow(
      /CLERK_SECRET_KEY/,
    );
  });

  it('warns loudly when the payment wall is down', () => {
    validateEnv({ ...productionBase, PAYMENTS_ENABLED: 'false' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('PAYMENTS_ENABLED=false'));
  });

  it('does not require Stripe outside production regardless of the flag', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://localhost:5432/db' })).not.toThrow();
  });
});
