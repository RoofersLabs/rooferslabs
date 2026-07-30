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
 * when it is off. A dormant provider's variables are never required — which is
 * what lets the platform run with no Stripe account whatsoever.
 */
import { PaymentProvider } from '@rooferslabs/shared';
import { PROVIDER_REQUIRED_ENV, activePaymentProvider, isPaymentsEnabled } from './payments.flag';

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

/** Development-only hints for the credentials production requires outright. */
const DEV_HINTS: Record<PaymentProvider, Record<string, string>> = {
  [PaymentProvider.PADDLE]: {
    PADDLE_API_KEY: 'billing endpoints will return 503 until a sandbox key is set',
    PADDLE_CLIENT_TOKEN: 'the checkout cannot open in the browser without it',
  },
  [PaymentProvider.STRIPE]: {
    STRIPE_SECRET_KEY: 'billing endpoints will return 503 until a test key is set',
  },
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = (config.NODE_ENV ?? 'development') === 'production';
  const env = config as NodeJS.ProcessEnv;
  const paymentsEnabled = isPaymentsEnabled(env);
  // Throws on an unrecognized value, which is deliberate: booting against a
  // processor nobody chose is worse than failing the deployment.
  const provider = activePaymentProvider(env);
  const missing: string[] = [];

  for (const key of REQUIRED_ALWAYS) {
    if (!config[key]) missing.push(key);
  }

  if (isProduction) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) missing.push(key);
    }
    // Billing gates every tenant's access to the product, so a production boot
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

  // The structured logger is not constructed yet at env-validation time.
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
  const warnings = isProduction ? FEATURE_CREDENTIALS : { ...FEATURE_CREDENTIALS, ...hints };
  for (const [key, consequence] of Object.entries(warnings)) {
    if (!config[key]) {
      console.warn(`[env] ${key} is not set — ${consequence}.`);
    }
  }

  return config;
}
