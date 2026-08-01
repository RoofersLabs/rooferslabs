/**
 * The payment feature flags, read straight from the environment.
 *
 * These live apart from {@link AppConfigService} because two things need the
 * answers before the DI container exists: startup env validation (which decides
 * which provider's credentials are mandatory) and BillingModule's decorator
 * (which decides which webhook route is registered at all). Everything inside
 * the container should read `config.payments`.
 */
import { PaymentProvider } from '@rooferslabs/shared';

/**
 * Whether billing is switched on platform-wide.
 *
 * Defaults to enabled. Turning the payment wall off has to be deliberate — a
 * typo'd or absent variable must never silently hand the product away for free.
 */
export function isPaymentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.PAYMENTS_ENABLED?.trim().toLowerCase();
  if (raw === undefined || raw === '') return true;
  return !['false', '0', 'no', 'off'].includes(raw);
}

/**
 * Which processor handles money today.
 *
 * Defaults to PayPal, the provider the platform currently bills through. An
 * unrecognized value is a configuration error rather than something to guess
 * at: silently falling back would mean booting against a processor the operator
 * did not choose, so it throws and the deployment fails visibly.
 */
export function activePaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const raw = env.PAYMENT_PROVIDER?.trim().toUpperCase();
  if (raw === undefined || raw === '') return PaymentProvider.PAYPAL;
  if (raw in PaymentProvider) return raw as PaymentProvider;

  throw new Error(
    `PAYMENT_PROVIDER='${env.PAYMENT_PROVIDER}' is not a supported provider. ` +
      `Use one of: ${Object.values(PaymentProvider).join(', ').toLowerCase()}.`,
  );
}

/**
 * The variables each provider cannot run without once payments are on.
 *
 * Only the active provider's list is enforced (see env.validation.ts), which is
 * what lets the platform boot with no Stripe account at all while Stripe is the
 * dormant provider — and, symmetrically, what would let it boot without PayPal
 * if the two were ever swapped.
 */
export const PROVIDER_REQUIRED_ENV: Record<PaymentProvider, readonly string[]> = {
  // PayPal needs only credentials. The product, the plans and the webhook are
  // provisioned by `billing:paypal:setup` and persisted in `billing_catalog`,
  // so no identifier is ever an environment variable — which is why this list
  // is two entries long and not seven. Whether the provisioning actually ran is
  // a separate question, answered at boot by BillingReadinessService.
  [PaymentProvider.PAYPAL]: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  [PaymentProvider.STRIPE]: [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_STARTER',
    'STRIPE_PRICE_PROFESSIONAL',
  ],
};
