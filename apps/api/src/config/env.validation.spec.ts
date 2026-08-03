import { validateEnv } from './env.validation';

/** A fully-configured production environment. */
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

beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('validateEnv — production requirements', () => {
  it('boots a fully configured production API', () => {
    expect(() => validateEnv({ ...productionBase })).not.toThrow();
  });

  it('refuses to boot production without the Clerk secret', () => {
    expect(() => validateEnv({ ...productionBase, CLERK_SECRET_KEY: '' })).toThrow(
      /CLERK_SECRET_KEY/,
    );
  });

  it('requires nothing but a database outside a deployed tier', () => {
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
   * The regression this exists for: a deployed process reading a `DATABASE_URL`
   * of `postgresql://…@localhost:5432/…` from the root `.env` while
   * `APP_ENV=development` claimed it was talking to AWS, and connecting to
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
