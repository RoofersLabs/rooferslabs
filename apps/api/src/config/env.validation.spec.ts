import { validateEnv } from './env.validation';

/** A production environment with everything except the billing credentials. */
const productionBase = {
  NODE_ENV: 'production',
  // AWS endpoints, not localhost: a deployed tier pointed at the machine
  // running the process is now a fatal misconfiguration, so a fixture that used
  // localhost would be testing a state that can no longer exist.
  DATABASE_URL: 'postgresql://u:p@rooferslabs-production.x.rds.amazonaws.com:5432/db',
  CLERK_SECRET_KEY: 'sk_test',
  CLERK_PUBLISHABLE_KEY: 'pk_test',
  REDIS_URL: 'redis://rooferslabs-production.x.cache.amazonaws.com:6379',
  API_PUBLIC_URL: 'https://api.example.com',
  WEB_PUBLIC_URL: 'https://example.com',
};

const paypalCredentials = {
  PAYPAL_CLIENT_ID: 'AeA1QIZ...',
  PAYPAL_CLIENT_SECRET: 'EGnHDxD...',
  PAYPAL_WEBHOOK_ID: '8PT597110X687430LKGECATA',
  PAYPAL_PLAN_STARTER_MONTHLY: 'P-5ML4271244454362WXNWU5NQ',
  PAYPAL_PLAN_PROFESSIONAL_MONTHLY: 'P-1RN14801Y5581574TXNWU5PA',
};

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('validateEnv — billing requirements', () => {
  it('boots a production API with no billing variables when payments are disabled', () => {
    // The whole point of the flag: ship before the payment account is approved.
    expect(() => validateEnv({ ...productionBase, PAYMENTS_ENABLED: 'false' })).not.toThrow();
  });

  it('refuses to boot production with payments enabled and PayPal missing', () => {
    // A production boot with the wall on but no working provider would lock
    // every customer out, so this must stay fatal.
    expect(() => validateEnv({ ...productionBase })).toThrow(/PAYPAL_CLIENT_ID/);
  });

  it('names every missing PayPal variable at once', () => {
    expect(() => validateEnv({ ...productionBase })).toThrow(
      /PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET/,
    );
  });

  /**
   * The point of the provisioning system: identifiers are not configuration.
   * The product, the plans and the webhook are created by
   * `billing:paypal:setup` and read from `billing_catalog`, so demanding them
   * here would reintroduce exactly the manual step it removed. Whether the
   * provisioning actually ran is checked at boot by BillingReadinessService,
   * not by env validation.
   */
  it('never demands a plan, product or webhook identifier', () => {
    const error = (() => {
      try {
        validateEnv({ ...productionBase });
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    })();

    expect(error).not.toMatch(/PAYPAL_PLAN_/);
    expect(error).not.toMatch(/PAYPAL_WEBHOOK_ID/);
    expect(error).not.toMatch(/PRODUCT/i);
  });

  it('boots with only the two credentials', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        PAYPAL_CLIENT_ID: 'AeA1QIZ...',
        PAYPAL_CLIENT_SECRET: 'EGnHDxD...',
      }),
    ).not.toThrow();
  });

  it('boots production with payments enabled once PayPal is configured', () => {
    expect(() => validateEnv({ ...productionBase, ...paypalCredentials })).not.toThrow();
  });

  it('accepts the provider named explicitly', () => {
    expect(() =>
      validateEnv({ ...productionBase, ...paypalCredentials, PAYMENT_PROVIDER: 'paypal' }),
    ).not.toThrow();
  });

  it('does not require annual plans — they are optional until launched', () => {
    // Annual is modelled but not sold; requiring its plan ids would block a
    // boot over a plan nobody can buy yet.
    expect(() => validateEnv({ ...productionBase, ...paypalCredentials })).not.toThrow();
  });

  it('rejects a retired provider rather than booting without an adapter', () => {
    // Stripe's adapter was removed with the rest of the multi-provider surface.
    // A deployment still naming it must fail the boot, not fall back silently.
    expect(() => validateEnv({ ...productionBase, PAYMENT_PROVIDER: 'stripe' })).toThrow(
      /not a supported provider/,
    );
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
    validateEnv({ ...productionBase, ...paypalCredentials });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Payment provider: paypal'));
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
    REDIS_URL: 'redis://rooferslabs-development.x.cache.amazonaws.com:6379',
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

describe('validateEnv — no localhost in a deployed tier', () => {
  /**
   * The regression this exists for. `billing:paypal:setup` read a
   * `DATABASE_URL` of `postgresql://…@localhost:5432/…` from the root `.env`
   * while `APP_ENV=development` claimed it was talking to AWS, and connected to
   * nothing. Presence checks passed; the failure surfaced as a refused
   * connection rather than as the configuration mistake it was.
   */
  const deployed = {
    APP_ENV: 'development',
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://u:p@rooferslabs-development.x.rds.amazonaws.com:5432/db',
    CLERK_SECRET_KEY: 'sk_test',
    CLERK_PUBLISHABLE_KEY: 'pk_test',
    REDIS_URL: 'redis://rooferslabs-development.x.cache.amazonaws.com:6379',
    API_PUBLIC_URL: 'https://api.dev.example.com',
    WEB_PUBLIC_URL: 'https://dev.example.com',
    PAYMENTS_ENABLED: 'false',
  };

  it('accepts a deployed environment wired to AWS', () => {
    expect(() => validateEnv({ ...deployed })).not.toThrow();
  });

  it.each([
    ['postgresql://u:p@localhost:5432/db', 'DATABASE_URL'],
    ['postgresql://u:p@127.0.0.1:5432/db', 'DATABASE_URL'],
  ])('refuses DATABASE_URL=%s', (url) => {
    expect(() => validateEnv({ ...deployed, DATABASE_URL: url })).toThrow(/localhost/i);
  });

  it('refuses a localhost REDIS_URL', () => {
    expect(() => validateEnv({ ...deployed, REDIS_URL: 'redis://localhost:6379' })).toThrow(
      /REDIS_URL/,
    );
  });

  it('names every offending variable at once', () => {
    expect(() =>
      validateEnv({
        ...deployed,
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrow(/DATABASE_URL and REDIS_URL/);
  });

  /**
   * A developer machine sets neither APP_ENV nor a deployed tier, and is free
   * to point anywhere — the guard is about environments that claim to be AWS.
   */
  it('leaves a non-deployed run alone', () => {
    expect(() => validateEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' })).not.toThrow();
  });
});

/**
 * The regression these cover shipped to production: the frontend bundle was
 * rebuilt with the live Clerk publishable key while CLERK_SECRET_KEY stayed on
 * the development instance. Sign-in worked, health checks worked, telephony
 * worked, and every authenticated request answered 401 — because `verifyToken`
 * resolves the JWKS from the secret key's instance and the tokens were minted
 * by the other one.
 */
describe('validateEnv — Clerk instance pairing', () => {
  const withKeys = (publishable: string, secret: string) => ({
    ...productionBase,
    PAYMENTS_ENABLED: 'false',
    CLERK_PUBLISHABLE_KEY: publishable,
    CLERK_SECRET_KEY: secret,
  });

  it('refuses a live publishable key paired with a development secret key', () => {
    expect(() => validateEnv(withKeys('pk_live_abc', 'sk_test_abc'))).toThrow(
      /CLERK_PUBLISHABLE_KEY is from Clerk's live instance but CLERK_SECRET_KEY is from the test instance/,
    );
  });

  it('refuses the mirror image, so neither key is privileged over the other', () => {
    expect(() => validateEnv(withKeys('pk_test_abc', 'sk_live_abc'))).toThrow(
      /from Clerk's test instance but CLERK_SECRET_KEY is from the live instance/,
    );
  });

  it('explains the 401 the mismatch causes, since that is the only symptom', () => {
    expect(() => validateEnv(withKeys('pk_live_abc', 'sk_test_abc'))).toThrow(/401/);
  });

  it('accepts a matched live pair', () => {
    expect(() => validateEnv(withKeys('pk_live_abc', 'sk_live_abc'))).not.toThrow();
  });

  it('accepts a matched test pair — wrong for production, but not incoherent', () => {
    expect(() => validateEnv(withKeys('pk_test_abc', 'sk_test_abc'))).not.toThrow();
  });

  /**
   * Key formats are Clerk's to define, not this check's. Rejecting an
   * unrecognised prefix here would turn a future key format into a boot failure
   * for a configuration that is actually fine.
   */
  it('ignores keys whose prefix it does not recognise', () => {
    expect(() => validateEnv(withKeys('pk_live_abc', 'some-proxy-managed-value'))).not.toThrow();
  });

  it('warns rather than failing when production runs a consistent test pair', () => {
    // It is a real serving configuration — it is how production ran before the
    // cutover — so refusing to boot would take down working telephony.
    const warn = jest.spyOn(console, 'warn');
    expect(() => validateEnv(withKeys('pk_test_abc', 'sk_test_abc'))).not.toThrow();
    expect(warn.mock.calls.flat().join('\n')).toMatch(/DEVELOPMENT instance/);
  });
});
