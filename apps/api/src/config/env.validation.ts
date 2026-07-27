/**
 * Startup environment validation.
 *
 * Fails fast on boot if a required variable is missing. Only variables that are
 * strictly required for the process to run correctly are enforced here; feature
 * credentials (OpenAI, Twilio, AWS) are validated lazily by their adapters so
 * the platform can boot for local development before every integration is wired.
 *
 * Stripe sits between the two: mandatory in production while PAYMENTS_ENABLED is
 * on, and not required at all when it is off.
 */
import { STRIPE_REQUIRED_ENV, isPaymentsEnabled } from './payments.flag';

const REQUIRED_ALWAYS = ['DATABASE_URL'] as const;

const REQUIRED_IN_PRODUCTION = [
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

/** Development-only hints for credentials that production requires outright. */
const DEV_HINTS: Record<string, string> = {
  STRIPE_SECRET_KEY: 'billing endpoints will return 502 until a test key is set',
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = (config.NODE_ENV ?? 'development') === 'production';
  const paymentsEnabled = isPaymentsEnabled(config as NodeJS.ProcessEnv);
  const missing: string[] = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!config[key]) missing.push(key);
  }

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) missing.push(key);
    }
    // Billing gates every tenant's access to the product, so a production boot
    // with payments ON but no Stripe would lock every customer out — fail fast.
    // With payments OFF there is no wall to enforce, so the keys are not needed
    // and the platform boots without a Stripe account at all.
    if (paymentsEnabled) {
      for (const key of STRIPE_REQUIRED_ENV) {
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

  // The structured logger is not constructed yet at env-validation time.
  if (!paymentsEnabled) {
    // Operationally load-bearing: with the wall down every tenant reaches the
    // product for free, so it must be obvious in the boot logs why.
    console.warn(
      '[env] PAYMENTS_ENABLED=false — Stripe is disabled: no client, no webhook ' +
        'route, billing endpoints return 503, and every tenant has full access ' +
        'without a subscription. Set PAYMENTS_ENABLED=true to restore the wall.',
    );
  }

  const stripeHints = paymentsEnabled ? DEV_HINTS : {};
  const warnings = isProduction ? FEATURE_CREDENTIALS : { ...FEATURE_CREDENTIALS, ...stripeHints };
  for (const [key, consequence] of Object.entries(warnings)) {
    if (!config[key]) {
      console.warn(`[env] ${key} is not set — ${consequence}.`);
    }
  }

  return config;
}
