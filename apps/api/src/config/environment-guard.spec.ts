import {
  checkEnvironmentIsolation,
  classifyClerk,
  classifyEndpoint,
  classifyPaddle,
  resolveAppEnv,
} from './environment-guard';

// Shaped like the real endpoints Terraform produces, so the classifier is
// tested against the strings it will actually see rather than an idealised form.
const PROD_DB =
  'postgresql://rooferslabs:pw@rooferslabs-production.cluster-abc.us-east-1.rds.amazonaws.com:5432/rooferslabs?schema=public';
const DEV_DB =
  'postgresql://rooferslabs:pw@rooferslabs-development.abc.us-east-1.rds.amazonaws.com:5432/rooferslabs?schema=public&sslmode=require';
const PROD_REDIS = 'redis://rooferslabs-production.abc.cache.amazonaws.com:6379';
const LOCAL_DB = 'postgresql://rooferslabs:rooferslabs@localhost:5432/rooferslabs';
const LOCAL_REDIS = 'redis://localhost:6379';

describe('classifyEndpoint', () => {
  it('recognises each tier from the Terraform naming convention', () => {
    expect(classifyEndpoint(PROD_DB)).toBe('production');
    expect(classifyEndpoint(DEV_DB)).toBe('development');
    expect(classifyEndpoint(PROD_REDIS)).toBe('production');
    expect(classifyEndpoint(LOCAL_DB)).toBe('local');
    expect(classifyEndpoint(LOCAL_REDIS)).toBe('local');
  });

  it('reports unknown rather than guessing', () => {
    expect(classifyEndpoint(undefined)).toBe('unknown');
    expect(classifyEndpoint('not a url')).toBe('unknown');
    expect(classifyEndpoint('postgresql://user:pw@db.example.com:5432/x')).toBe('unknown');
  });
});

describe('classifyClerk', () => {
  it('distinguishes the production and development instances', () => {
    expect(classifyClerk('pk_live_abc', 'sk_live_abc')).toBe('production');
    expect(classifyClerk('pk_test_abc', 'sk_test_abc')).toBe('development');
    expect(classifyClerk(undefined, undefined)).toBe('unknown');
  });
});

describe('classifyPaddle', () => {
  it('lets the API key override the declared environment', () => {
    // The key decides which system is really charged, so it wins.
    expect(classifyPaddle('sandbox', 'pdl_live_abc')).toBe('production');
    expect(classifyPaddle('production', 'pdl_sdbx_abc')).toBe('development');
  });

  it('falls back to the declared environment when there is no key', () => {
    expect(classifyPaddle('sandbox', undefined)).toBe('development');
    expect(classifyPaddle('production', undefined)).toBe('production');
    expect(classifyPaddle(undefined, undefined)).toBe('unknown');
  });
});

describe('checkEnvironmentIsolation — production', () => {
  const productionEnv = {
    DATABASE_URL: PROD_DB,
    REDIS_URL: PROD_REDIS,
    CLERK_PUBLISHABLE_KEY: 'pk_live_abc',
    CLERK_SECRET_KEY: 'sk_live_abc',
    PAYMENTS_ENABLED: 'true',
    PAYMENT_PROVIDER: 'paddle',
    PADDLE_ENVIRONMENT: 'production',
    PADDLE_API_KEY: 'pdl_live_abc',
  } as NodeJS.ProcessEnv;

  it('accepts a correctly configured production environment', () => {
    const { errors, warnings } = checkEnvironmentIsolation(productionEnv, 'production');
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('refuses a development database', () => {
    const { errors } = checkEnvironmentIsolation(
      { ...productionEnv, DATABASE_URL: DEV_DB },
      'production',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('DATABASE_URL');
    expect(errors[0]).toContain('DEVELOPMENT');
  });

  it('refuses a local database — production must never point at a laptop', () => {
    const { errors } = checkEnvironmentIsolation(
      { ...productionEnv, DATABASE_URL: LOCAL_DB },
      'production',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('LOCAL');
  });

  it('refuses Clerk development keys', () => {
    const { errors } = checkEnvironmentIsolation(
      { ...productionEnv, CLERK_PUBLISHABLE_KEY: 'pk_test_abc', CLERK_SECRET_KEY: 'sk_test_abc' },
      'production',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Clerk');
  });

  it('refuses Paddle sandbox', () => {
    const { errors } = checkEnvironmentIsolation(
      { ...productionEnv, PADDLE_ENVIRONMENT: 'sandbox', PADDLE_API_KEY: 'pdl_sdbx_abc' },
      'production',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Paddle');
  });

  it('ignores Paddle entirely when the payment wall is down', () => {
    // With PAYMENTS_ENABLED=false no provider client is constructed, so a stale
    // sandbox key configures nothing and must not block a boot.
    const { errors } = checkEnvironmentIsolation(
      {
        ...productionEnv,
        PAYMENTS_ENABLED: 'false',
        PADDLE_ENVIRONMENT: 'sandbox',
        PADDLE_API_KEY: 'pdl_sdbx_abc',
      },
      'production',
    );
    expect(errors).toEqual([]);
  });

  it('reports every violation at once rather than one per restart', () => {
    const { errors } = checkEnvironmentIsolation(
      {
        ...productionEnv,
        DATABASE_URL: DEV_DB,
        REDIS_URL: LOCAL_REDIS,
        CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
        CLERK_SECRET_KEY: 'sk_test_abc',
      },
      'production',
    );
    expect(errors).toHaveLength(3);
  });
});

describe('checkEnvironmentIsolation — development', () => {
  const developmentEnv = {
    DATABASE_URL: DEV_DB,
    REDIS_URL: LOCAL_REDIS,
    CLERK_PUBLISHABLE_KEY: 'pk_test_abc',
    CLERK_SECRET_KEY: 'sk_test_abc',
    PAYMENTS_ENABLED: 'false',
  } as NodeJS.ProcessEnv;

  it('accepts the intended local setup: dev RDS plus Docker Redis', () => {
    const { errors, warnings } = checkEnvironmentIsolation(developmentEnv, 'development');
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('warns — but never throws — on a production database', () => {
    const { errors, warnings } = checkEnvironmentIsolation(
      { ...developmentEnv, DATABASE_URL: PROD_DB },
      'development',
    );
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('LIVE CUSTOMER DATA');
  });

  it('warns on production Clerk keys', () => {
    const { warnings } = checkEnvironmentIsolation(
      { ...developmentEnv, CLERK_PUBLISHABLE_KEY: 'pk_live_abc', CLERK_SECRET_KEY: 'sk_live_abc' },
      'development',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Clerk');
  });

  it('warns on live Paddle credentials', () => {
    const { warnings } = checkEnvironmentIsolation(
      {
        ...developmentEnv,
        PAYMENTS_ENABLED: 'true',
        PAYMENT_PROVIDER: 'paddle',
        PADDLE_ENVIRONMENT: 'sandbox',
        PADDLE_API_KEY: 'pdl_live_abc',
      },
      'development',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('charge real payment methods');
  });
});

describe('resolveAppEnv', () => {
  it('grants production only when named explicitly', () => {
    expect(resolveAppEnv({ APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBe('production');
  });

  it('defaults anything else to development', () => {
    expect(resolveAppEnv({} as NodeJS.ProcessEnv)).toBe('development');
    expect(resolveAppEnv({ APP_ENV: 'devstage' } as NodeJS.ProcessEnv)).toBe('development');
    expect(resolveAppEnv({ APP_ENV: 'PRODUCTION' } as NodeJS.ProcessEnv)).toBe('development');
    // NODE_ENV must not be able to confer production authority on its own.
    expect(resolveAppEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe('development');
  });
});
