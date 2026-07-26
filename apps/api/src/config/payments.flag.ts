/**
 * The payments feature flag, read straight from the environment.
 *
 * This lives apart from {@link AppConfigService} because two things need the
 * answer before the DI container exists: startup env validation (which decides
 * whether the STRIPE_* variables are mandatory) and BillingModule's decorator
 * (which decides whether the Stripe webhook route is registered at all).
 * Everything inside the container should read `config.payments.enabled`.
 *
 * Defaults to enabled. Turning the payment wall off has to be deliberate — a
 * typo'd or absent variable must never silently hand the product away for free.
 */
export function isPaymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.PAYMENTS_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === '') return true;
  return !['false', '0', 'no', 'off'].includes(raw);
}

/** The STRIPE_* variables billing cannot run without once payments are on. */
export const STRIPE_REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_PROFESSIONAL',
] as const;
