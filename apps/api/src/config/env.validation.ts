/**
 * Startup environment validation.
 *
 * Fails fast on boot if a required variable is missing. Only variables that are
 * strictly required for the process to run correctly are enforced here; feature
 * credentials (OpenAI, Twilio, AWS) are validated lazily by their adapters so
 * the platform can boot for local development before every integration is wired.
 *
 * Billing sits between the two: the *active* provider's credentials are
 * mandatory in production while PAYMENTS_ENABLED is on, and not required at all
 * when it is off.
 *
 * "Production" here means any DEPLOYED environment, not NODE_ENV=production.
 * The development environment runs with NODE_ENV=development so it keeps
 * readable diagnostics, and it is still a real deployment serving a real
 * database — so it is held to the same configuration standard. See
 * environment-guard.ts.
 */
import { PaymentProvider } from '@rooferslabs/shared';
import { PROVIDER_REQUIRED_ENV, activePaymentProvider, isPaymentsEnabled } from './payments.flag';
import { assertEnvironmentIsolation, resolveEnvironment } from './environment-guard';

const REQUIRED_ALWAYS = ['DATABASE_URL'] as const;

/**
 * Infrastructure endpoints that must never point at the machine running the
 * process once it claims to be a deployed environment.
 *
 * There is no local database or cache in this project — every environment's
 * Postgres and Redis live in AWS, in private subnets. A deployed process that
 * resolved either to localhost would boot, pass every presence check, and then
 * fail on the first query with a connection refusal that reads like an outage
 * rather than the configuration mistake it is.
 *
 * This is the check that would have caught `billing:paypal:setup` reading a
 * `DATABASE_URL` of `postgresql://…@localhost:5432/…` while `APP_ENV=development`
 * said it was talking to AWS.
 */
const MUST_NOT_BE_LOCAL = ['DATABASE_URL', 'REDIS_URL'] as const;

/** Hosts that mean "this machine" in a connection string. */
const LOCAL_HOSTS = /(^|@|\/\/)(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i;

const REQUIRED_WHEN_DEPLOYED = [
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'REDIS_URL',
  'API_PUBLIC_URL',
  'WEB_PUBLIC_URL',
] as const;

/** Feature credentials: their absence degrades a capability rather than the
 *  platform, so production boots with a loud warning instead of failing. */
const FEATURE_CREDENTIALS: Record<string, string> = {
  OPENAI_API_KEY: 'the AI receptionist and post-call analysis are disabled',
  TWILIO_ACCOUNT_SID: 'telephony (inbound calls) is disabled',
  TWILIO_AUTH_TOKEN: 'Twilio webhooks and media streams will be rejected',
};

/**
 * Which Clerk instance a key belongs to, from its prefix. Clerk issues every
 * key as `pk_test_`/`sk_test_` (development instance) or `pk_live_`/`sk_live_`
 * (production instance); the two instances have separate user pools, separate
 * sessions and separate JWKS.
 */
function clerkTier(key: string | undefined): 'live' | 'test' | null {
  if (typeof key !== 'string') return null;
  if (/^(pk|sk)_live_/.test(key)) return 'live';
  if (/^(pk|sk)_test_/.test(key)) return 'test';
  return null;
}

/**
 * A publishable and a secret key from different Clerk instances is the one
 * misconfiguration that produces no error until a user is already signed in:
 * `verifyToken` fetches the JWKS belonging to CLERK_SECRET_KEY, so a token
 * minted by the other instance fails signature verification and every
 * authenticated request answers 401 — while sign-in itself, health checks and
 * all public routes keep working perfectly.
 *
 * Refusing to boot converts that into a failed deployment, which is the same
 * information an hour earlier and addressed to the person who caused it.
 */
function assertClerkInstancesMatch(config: Record<string, unknown>): void {
  const secret = config.CLERK_SECRET_KEY as string | undefined;
  const publishable = config.CLERK_PUBLISHABLE_KEY as string | undefined;
  const secretTier = clerkTier(secret);
  const publishableTier = clerkTier(publishable);

  // An unrecognized prefix is left to Clerk to reject: this check owns the
  // relationship between the two keys, not the validity of either one.
  if (!secretTier || !publishableTier || secretTier === publishableTier) return;

  throw new Error(
    `CLERK_PUBLISHABLE_KEY is from Clerk's ${publishableTier} instance but CLERK_SECRET_KEY ` +
      `is from the ${secretTier} instance. They must be the same Clerk application: the API ` +
      `verifies session tokens against the JWKS belonging to CLERK_SECRET_KEY, so with these ` +
      `mixed every signed-in request would fail with 401 while sign-in appeared to succeed. ` +
      `Take both keys from one instance in Clerk Dashboard → API Keys.`,
  );
}

/** Development-only hints for the credentials production requires outright. */
const DEV_HINTS: Record<PaymentProvider, Record<string, string>> = {
  [PaymentProvider.PAYPAL]: {
    PAYPAL_CLIENT_ID: 'billing endpoints will return 503 until sandbox credentials are set',
    PAYPAL_CLIENT_SECRET:
      'no access token can be minted, so every PayPal call — including `billing:paypal:setup` — fails',
  },
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const env = config as NodeJS.ProcessEnv;
  // Throws on an APP_ENV that names no tier — before anything else reads it.
  const { tier, isDeployed } = resolveEnvironment(env);
  // A process wired to the other environment's database must never reach the
  // point of serving a request, so this is the first thing checked.
  assertEnvironmentIsolation(tier, env);

  const paymentsEnabled = isPaymentsEnabled(env);
  // Throws on an unrecognized value, which is deliberate: booting against a
  // processor nobody chose is worse than failing the deployment.
  const provider = activePaymentProvider(env);
  const missing: string[] = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!config[key]) missing.push(key);
  }

  if (isDeployed) {
    for (const key of REQUIRED_WHEN_DEPLOYED) {
      if (!config[key]) missing.push(key);
    }

    // A deployed tier pointed at localhost is a misconfiguration, not a
    // degraded mode — fail before serving a single request.
    const local = MUST_NOT_BE_LOCAL.filter((key) => {
      const value = config[key];
      return typeof value === 'string' && LOCAL_HOSTS.test(value);
    });
    if (local.length > 0) {
      throw new Error(
        `${local.join(' and ')} point${local.length > 1 ? '' : 's'} at localhost while APP_ENV=${tier}. ` +
          `There is no local database or cache in this project: every environment's Postgres and Redis ` +
          `live in AWS. Supply this environment's own connection strings, or unset APP_ENV to run ` +
          `outside a deployed tier.`,
      );
    }
    // Billing gates every tenant's access to the product, so a deployed boot
    // with payments ON but no working provider would lock every customer out —
    // fail fast. Only the active provider's variables are checked; the dormant
    // one's are never needed, so the platform boots without that account at all.
    if (paymentsEnabled) {
      for (const key of PROVIDER_REQUIRED_ENV[provider]) {
        if (!config[key]) missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See .env.example for guidance.`,
    );
  }

  // Checked in every tier, including local: a mixed pair is never intentional.
  assertClerkInstancesMatch(config);

  // The structured logger is not constructed yet at env-validation time.
  // Which environment a container thinks it is is the first thing anyone reads
  // when a deploy behaves unexpectedly, so it leads the boot output.
  console.warn(`[env] Deployment tier: ${tier}${isDeployed ? '' : ' (local)'}.`);

  // Production on Clerk's development instance is a real, serving configuration
  // — public routes and telephony work — so this warns rather than refusing to
  // boot. It is still wrong: live visitors sign in to a *.clerk.accounts.dev
  // user pool, and the frontend bundle must be carrying a matching pk_test_ key
  // for it to work at all, which the web deploy now refuses to publish.
  if (
    tier === 'production' &&
    clerkTier(config.CLERK_SECRET_KEY as string | undefined) === 'test'
  ) {
    console.warn(
      '[env] CLERK_SECRET_KEY is a test key — production is authenticating against ' +
        "Clerk's DEVELOPMENT instance. Supply the live instance's sk_live_ key " +
        '(clerk_secret_key in infra/terraform/envs/production) to complete the cutover.',
    );
  }

  if (!paymentsEnabled) {
    // Operationally load-bearing: with the wall down every tenant reaches the
    // product for free, so it must be obvious in the boot logs why.
    console.warn(
      '[env] PAYMENTS_ENABLED=false — billing is disabled: no provider client, no ' +
        'webhook route, billing endpoints return 503, and every tenant has full ' +
        'access without a subscription. Set PAYMENTS_ENABLED=true to restore the wall.',
    );
  } else {
    console.warn(`[env] Payment provider: ${provider.toLowerCase()}.`);
  }

  const hints = paymentsEnabled ? DEV_HINTS[provider] : {};
  const warnings = isDeployed ? FEATURE_CREDENTIALS : { ...FEATURE_CREDENTIALS, ...hints };
  for (const [key, consequence] of Object.entries(warnings)) {
    if (!config[key]) {
      console.warn(`[env] ${key} is not set — ${consequence}.`);
    }
  }

  return config;
}
