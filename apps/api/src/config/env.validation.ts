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
] as const;

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

  return config;
}
