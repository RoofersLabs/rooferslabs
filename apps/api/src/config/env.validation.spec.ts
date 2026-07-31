import { validateEnv } from './env.validation';

/** A production environment with everything except the billing credentials. */
const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://localhost:5432/db',
  CLERK_SECRET_KEY: 'sk_test',
  CLERK_PUBLISHABLE_KEY: 'pk_test',
  REDIS_URL: 'redis://localhost:6379',
  API_PUBLIC_URL: 'https://api.example.com',
  WEB_PUBLIC_URL: 'https://example.com',
};

const paddleCredentials = {
  PADDLE_API_KEY: 'pdl_live_key',
  PADDLE_WEBHOOK_SECRET: 'pdl_ntfset_secret',
  PADDLE_CLIENT_TOKEN: 'live_token',
  PADDLE_PRICE_STARTER_MONTHLY: 'pri_starter',
  PADDLE_PRICE_PROFESSIONAL_MONTHLY: 'pri_pro',
};

const stripeCredentials = {
  STRIPE_SECRET_KEY: 'sk_live',
  STRIPE_WEBHOOK_SECRET: 'whsec',
  STRIPE_PRICE_STARTER: 'price_starter',
  STRIPE_PRICE_PROFESSIONAL: 'price_pro',
};

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('validateEnv — billing requirements', () => {
  it('boots a production API with no billing variables when payments are disabled', () => {
    // The whole point of the flag: ship before the payment account is approved.
    expect(() => validateEnv({ ...productionBase, PAYMENTS_ENABLED: 'false' })).not.toThrow();
  });

  it('refuses to boot production with payments enabled and Paddle missing', () => {
    // A production boot with the wall on but no working provider would lock
    // every customer out, so this must stay fatal.
    expect(() => validateEnv({ ...productionBase })).toThrow(/PADDLE_API_KEY/);
  });

  it('names every missing Paddle variable at once', () => {
    expect(() => validateEnv({ ...productionBase })).toThrow(
      /PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_CLIENT_TOKEN, PADDLE_PRICE_STARTER_MONTHLY, PADDLE_PRICE_PROFESSIONAL_MONTHLY/,
    );
  });

  it('boots production with payments enabled once Paddle is configured', () => {
    expect(() => validateEnv({ ...productionBase, ...paddleCredentials })).not.toThrow();
  });

  it('never requires the dormant provider', () => {
    // The core promise of the migration: the platform runs with no Stripe
    // account at all. Paddle alone must be enough to boot production.
    expect(() =>
      validateEnv({ ...productionBase, ...paddleCredentials, PAYMENT_PROVIDER: 'paddle' }),
    ).not.toThrow();
  });

  it('does not require annual prices — they are optional until launched', () => {
    // Annual is modelled but not sold; requiring its prices would block a boot
    // over a plan nobody can buy yet.
    expect(() => validateEnv({ ...productionBase, ...paddleCredentials })).not.toThrow();
  });

  it('requires Stripe instead when Stripe is the selected provider', () => {
    // The mirror image, and the test that proves switching back is a
    // configuration change: with PAYMENT_PROVIDER=stripe the Stripe variables
    // become mandatory and the Paddle ones stop being needed.
    expect(() => validateEnv({ ...productionBase, PAYMENT_PROVIDER: 'stripe' })).toThrow(
      /STRIPE_SECRET_KEY/,
    );
    expect(() =>
      validateEnv({ ...productionBase, ...stripeCredentials, PAYMENT_PROVIDER: 'stripe' }),
    ).not.toThrow();
  });

  it('rejects an unknown provider rather than guessing', () => {
    // Falling back to a default would mean billing through a processor the
    // operator did not choose.
    expect(() => validateEnv({ ...productionBase, PAYMENT_PROVIDER: 'braintree' })).toThrow(
      /not a supported provider/,
    );
  });

  it('still enforces the non-billing production requirements when payments are off', () => {
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

  it('reports which provider is active on boot', () => {
    validateEnv({ ...productionBase, ...paddleCredentials });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Payment provider: paddle'));
  });

  it('does not require billing credentials outside production regardless of the flag', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://localhost:5432/db' })).not.toThrow();
  });
});

describe('validateEnv — deployment tier', () => {
  /** The development environment: a real deployment, running NODE_ENV=development. */
  const deployedDevelopment = {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://u:p@rooferslabs-development.x.rds.amazonaws.com:5432/db',
    CLERK_SECRET_KEY: 'sk_test',
    CLERK_PUBLISHABLE_KEY: 'pk_test',
    REDIS_URL: 'redis://localhost:6379',
    API_PUBLIC_URL: 'https://api.dev.example.com',
    WEB_PUBLIC_URL: 'https://dev.example.com',
    PAYMENTS_ENABLED: 'false',
  };

  it('holds a deployed development environment to the full configuration check', () => {
    // The point of separating APP_ENV from NODE_ENV. Before it, running the
    // development environment with NODE_ENV=development meant a missing Clerk
    // key booted fine and failed on the first sign-in instead.
    expect(() => validateEnv({ ...deployedDevelopment, CLERK_SECRET_KEY: '' })).toThrow(
      /CLERK_SECRET_KEY/,
    );

    expect(() => validateEnv({ ...deployedDevelopment })).not.toThrow();
  });

  it('still exempts a developer machine, which sets neither variable', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://localhost:5432/db' })).not.toThrow();
  });

  it('refuses to boot when the database belongs to the other environment', () => {
    // The failure this whole environment split exists to make impossible.
    expect(() =>
      validateEnv({
        ...deployedDevelopment,
        DATABASE_URL: 'postgresql://u:p@rooferslabs-production.x.rds.amazonaws.com:5432/db',
      }),
    ).toThrow(/Environment isolation violated/);
  });

  it('reports the tier on boot', () => {
    validateEnv({ ...deployedDevelopment });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Deployment tier: development'),
    );
  });
});
