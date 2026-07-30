/**
 * Cross-environment isolation guard.
 *
 * Terraform already refuses to *plan* an environment against another
 * environment's credentials. This is the second half: the process refuses to
 * *run* on them. Both layers exist because they fail in different ways —
 * Terraform cannot see a value injected at runtime, and a running process
 * cannot see what a plan intended.
 *
 * The rule is asymmetric on purpose:
 *
 *   production   throws. Booting the live API against a development database,
 *                a development identity provider, or Paddle's sandbox is worse
 *                in every case than not booting at all: it silently serves
 *                customers wrong data, or takes payments that settle nowhere.
 *
 *   development  warns, loudly and repeatedly. A local process that has somehow
 *                acquired production credentials must be impossible to ignore,
 *                but throwing would leave a developer unable to start anything
 *                while they sort out their .env — and the usual cause is a
 *                half-finished config, not an attack.
 *
 * Detection is by naming convention, which holds because Terraform derives every
 * resource name from `rooferslabs-${var.environment}`. A hostname that matches
 * neither convention is reported as `unknown` rather than guessed at.
 */

export type AppEnv = 'production' | 'development';

/** Which environment a particular credential or endpoint belongs to. */
export type Tier = 'production' | 'development' | 'local' | 'unknown';

export interface IsolationReport {
  /** Fatal in production: the process must not start. */
  errors: string[];
  /** Never fatal: surfaced so a misconfiguration is visible immediately. */
  warnings: string[];
}

/** Hostnames that mean "this developer's own machine", never a shared tier. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // An unparseable URL is a separate problem, reported by the existing
    // required-variable checks. Do not also fail it here.
    return undefined;
  }
}

/**
 * Classify a database or cache endpoint by hostname.
 *
 * Terraform names the instances `rooferslabs-production` and
 * `rooferslabs-development`, and both appear in their endpoint hostnames, so
 * the substring is a reliable signal rather than a guess. Production is checked
 * first: `rooferslabs-production` contains neither of the other markers, but
 * ordering makes the intent explicit rather than incidental.
 */
export function classifyEndpoint(url: string | undefined): Tier {
  const host = hostOf(url);
  if (!host) return 'unknown';
  if (LOCAL_HOSTS.has(host)) return 'local';
  if (host.includes('rooferslabs-production')) return 'production';
  if (host.includes('rooferslabs-development')) return 'development';
  return 'unknown';
}

/**
 * Classify Clerk credentials by key prefix.
 *
 * Clerk issues `pk_live_`/`sk_live_` from a production instance and
 * `pk_test_`/`sk_test_` from a development one. The two instances have separate
 * user directories, so a mismatch here means authenticating real customers
 * against a directory that does not contain them.
 */
export function classifyClerk(publishableKey?: string, secretKey?: string): Tier {
  const key = publishableKey ?? secretKey;
  if (!key) return 'unknown';
  if (key.startsWith('pk_live_') || key.startsWith('sk_live_')) return 'production';
  if (key.startsWith('pk_test_') || key.startsWith('sk_test_')) return 'development';
  return 'unknown';
}

/**
 * Classify the Paddle configuration.
 *
 * PADDLE_ENVIRONMENT is the declared intent and the API key is the actual
 * credential. Both are consulted, and the key wins when they disagree: the key
 * determines which of Paddle's systems is really charged, and a mismatch
 * between the two is itself worth reporting.
 */
export function classifyPaddle(paddleEnvironment?: string, apiKey?: string): Tier {
  if (apiKey?.startsWith('pdl_live_')) return 'production';
  if (apiKey?.startsWith('pdl_sdbx_')) return 'development';
  if (paddleEnvironment === 'production') return 'production';
  if (paddleEnvironment === 'sandbox') return 'development';
  return 'unknown';
}

/** The tier a given APP_ENV is allowed to talk to, besides `unknown`. */
function permitted(appEnv: AppEnv): Tier[] {
  // Development may legitimately use local Docker for Redis and Postgres, so
  // `local` is allowed there and nowhere else.
  return appEnv === 'production' ? ['production'] : ['development', 'local'];
}

function describe(subject: string, found: Tier, appEnv: AppEnv, consequence: string): string {
  return (
    `${subject} is configured for the ${found.toUpperCase()} environment ` +
    `but APP_ENV=${appEnv}. ${consequence}`
  );
}

/**
 * Compare every externally-configured dependency against APP_ENV.
 *
 * Pure and side-effect free so it can be unit-tested directly; the throwing and
 * logging live in the caller.
 */
export function checkEnvironmentIsolation(env: NodeJS.ProcessEnv, appEnv: AppEnv): IsolationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allowed = permitted(appEnv);

  const checks: Array<{ subject: string; found: Tier; consequence: string }> = [
    {
      subject: 'DATABASE_URL',
      found: classifyEndpoint(env.DATABASE_URL),
      consequence:
        appEnv === 'production'
          ? 'The live API would read and write a database that holds no customer data.'
          : 'Local work would read and write LIVE CUSTOMER DATA, and any migration would apply to production.',
    },
    {
      subject: 'REDIS_URL',
      found: classifyEndpoint(env.REDIS_URL),
      consequence:
        appEnv === 'production'
          ? 'Sessions and cached data would be served from a development cache.'
          : 'Local work would read and evict live customer sessions.',
    },
    {
      subject: 'Clerk',
      found: classifyClerk(env.CLERK_PUBLISHABLE_KEY, env.CLERK_SECRET_KEY),
      consequence:
        appEnv === 'production'
          ? 'Live customers would authenticate against the development user directory.'
          : 'Test sign-ups would create real customer accounts in the live directory.',
    },
  ];

  // Paddle only matters when billing is actually on. With the wall down there is
  // no provider client, so a stale key configures nothing.
  if (env.PAYMENTS_ENABLED === 'true' && (env.PAYMENT_PROVIDER ?? 'paddle') === 'paddle') {
    checks.push({
      subject: 'Paddle',
      found: classifyPaddle(env.PADDLE_ENVIRONMENT, env.PADDLE_API_KEY),
      consequence:
        appEnv === 'production'
          ? 'The payment wall would be enforced by Paddle TEST and would settle no money.'
          : 'Local testing could charge real payment methods.',
    });
  }

  for (const { subject, found, consequence } of checks) {
    if (found === 'unknown' || allowed.includes(found)) continue;

    const message = describe(subject, found, appEnv, consequence);
    if (appEnv === 'production') {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  return { errors, warnings };
}

/**
 * Enforce the report: throw in production, shout in development.
 *
 * Called from validateEnv so it runs before Nest constructs anything that might
 * open a connection to the wrong place.
 */
export function assertEnvironmentIsolation(env: NodeJS.ProcessEnv, appEnv: AppEnv): void {
  const { errors, warnings } = checkEnvironmentIsolation(env, appEnv);

  for (const warning of warnings) {
    console.warn(`\n[env] ******** CROSS-ENVIRONMENT WARNING ********\n[env] ${warning}\n`);
  }

  if (errors.length === 0) return;

  throw new Error(
    `Refusing to start: this process is configured for APP_ENV=${appEnv} but ` +
      `depends on resources from another environment.\n\n` +
      errors.map((e) => `  - ${e}`).join('\n') +
      `\n\nThis is a safety guard, not a transient failure. Fix the configuration ` +
      `rather than bypassing it: see docs/environments.md.`,
  );
}

/**
 * Resolve the deployment tier.
 *
 * APP_ENV is set explicitly by Terraform for deployed environments. It is
 * deliberately distinct from NODE_ENV, which selects a *build* mode: a
 * production build running against development infrastructure is exactly the
 * combination a staging environment needs, and conflating the two makes that
 * impossible to express.
 *
 * Anything unrecognised resolves to `development`, so the only way to obtain
 * production's authority is to ask for it by name.
 */
export function resolveAppEnv(env: NodeJS.ProcessEnv): AppEnv {
  return env.APP_ENV === 'production' ? 'production' : 'development';
}
