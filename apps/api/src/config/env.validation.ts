/**
 * Startup environment validation.
 *
 * Fails fast on boot if a required variable is missing. Only variables that are
 * strictly required for the process to run correctly are enforced here; feature
 * credentials (OpenAI, Twilio, AWS) are validated lazily by their adapters so
 * the platform can boot for local development before every integration is wired.
 */

const REQUIRED_ALWAYS = ['DATABASE_URL'] as const;

const REQUIRED_IN_PRODUCTION = [
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'REDIS_URL',
  'API_PUBLIC_URL',
  'WEB_PUBLIC_URL',
  // Billing gates every tenant's access to the product, so a production boot
  // without Stripe would lock every customer out — fail fast instead.
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PROFESSIONAL',
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
  const missing: string[] = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!config[key]) missing.push(key);
  }

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `See .env.example for guidance.`,
    );
  }

  const warnings = isProduction ? FEATURE_CREDENTIALS : { ...FEATURE_CREDENTIALS, ...DEV_HINTS };
  for (const [key, consequence] of Object.entries(warnings)) {
    if (!config[key]) {
      // The structured logger is not constructed yet at env-validation time.
      console.warn(`[env] ${key} is not set — ${consequence}.`);
    }
  }

  return config;
}
