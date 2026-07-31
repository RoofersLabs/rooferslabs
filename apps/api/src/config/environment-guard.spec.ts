import {
  assertEnvironmentIsolation,
  findIsolationViolations,
  resolveEnvironment,
} from './environment-guard';

const env = (values: Record<string, string>): NodeJS.ProcessEnv => values as NodeJS.ProcessEnv;

const PRODUCTION_DB =
  'postgresql://u:p@rooferslabs-production.abc123.us-east-1.rds.amazonaws.com:5432/rooferslabs';
const DEVELOPMENT_DB =
  'postgresql://u:p@rooferslabs-development.abc123.us-east-1.rds.amazonaws.com:5432/rooferslabs';

describe('resolveEnvironment', () => {
  it('reads the tier from APP_ENV, independently of NODE_ENV', () => {
    // The whole reason the two exist separately: the development environment is
    // a real deployment that runs with development-grade Node diagnostics.
    expect(resolveEnvironment(env({ APP_ENV: 'development', NODE_ENV: 'development' }))).toEqual({
      tier: 'development',
      isDeployed: true,
    });
  });

  it('treats NODE_ENV=production as a deployment when APP_ENV is absent', () => {
    // Backwards compatibility: production ran without APP_ENV before this
    // existed, and a container that predates the variable must still validate
    // as a deployment rather than silently relax into local-development rules.
    expect(resolveEnvironment(env({ NODE_ENV: 'production' }))).toEqual({
      tier: 'production',
      isDeployed: true,
    });
  });

  it('treats a bare machine as local development', () => {
    expect(resolveEnvironment(env({}))).toEqual({ tier: 'development', isDeployed: false });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveEnvironment(env({ APP_ENV: ' Production ' })).tier).toBe('production');
  });

  it('refuses an APP_ENV that names no tier', () => {
    // Guessing would apply one environment's rules to the other's resources.
    expect(() => resolveEnvironment(env({ APP_ENV: 'staging' }))).toThrow(/not a deployment tier/);
  });
});

describe('findIsolationViolations', () => {
  it('passes when every resource belongs to this environment', () => {
    expect(
      findIsolationViolations(
        'production',
        env({
          DATABASE_URL: PRODUCTION_DB,
          REDIS_URL: 'redis://master.rooferslabs-production.x.use1.cache.amazonaws.com:6379',
          S3_BUCKET_RECORDINGS: 'rooferslabs-production-462292557780-recordings',
        }),
      ),
    ).toEqual([]);
  });

  it('catches production pointed at the development database', () => {
    expect(findIsolationViolations('production', env({ DATABASE_URL: DEVELOPMENT_DB }))).toEqual([
      { variable: 'DATABASE_URL', belongsTo: 'development' },
    ]);
  });

  it('catches development pointed at the production database', () => {
    // The more dangerous direction of the two: a development deploy writing
    // customer data. It is caught by the same rule rather than a special case.
    expect(findIsolationViolations('development', env({ DATABASE_URL: PRODUCTION_DB }))).toEqual([
      { variable: 'DATABASE_URL', belongsTo: 'production' },
    ]);
  });

  it('reports every crossed resource, not just the first', () => {
    const violations = findIsolationViolations(
      'development',
      env({
        DATABASE_URL: PRODUCTION_DB,
        S3_BUCKET_UPLOADS: 'rooferslabs-production-462292557780-uploads',
        SQS_QUEUE_URL:
          'https://sqs.us-east-1.amazonaws.com/462292557780/rooferslabs-production-jobs',
      }),
    );
    expect(violations.map((v) => v.variable)).toEqual([
      'DATABASE_URL',
      'S3_BUCKET_UPLOADS',
      'SQS_QUEUE_URL',
    ]);
  });

  it('ignores resources whose names claim no environment', () => {
    // Local Postgres, and anything created before this naming convention, are
    // not evidence of a crossed wire — flagging them would make the guard
    // something people switch off.
    expect(
      findIsolationViolations(
        'development',
        env({
          DATABASE_URL: 'postgresql://rooferslabs:rooferslabs@localhost:5432/rooferslabs',
          REDIS_URL: 'redis://localhost:6379',
        }),
      ),
    ).toEqual([]);
  });

  it('ignores variables that are absent or empty', () => {
    expect(findIsolationViolations('production', env({ DATABASE_URL: '' }))).toEqual([]);
  });
});

describe('assertEnvironmentIsolation', () => {
  it('does not throw for a correctly wired environment', () => {
    expect(() =>
      assertEnvironmentIsolation('development', env({ DATABASE_URL: DEVELOPMENT_DB })),
    ).not.toThrow();
  });

  it('names the variable and the environment it belongs to', () => {
    // The message has to be enough to fix it from a log line alone: at 3am the
    // reader has the CloudWatch stream and nothing else.
    expect(() =>
      assertEnvironmentIsolation('production', env({ DATABASE_URL: DEVELOPMENT_DB })),
    ).toThrow(/DATABASE_URL belongs to development/);
  });
});
