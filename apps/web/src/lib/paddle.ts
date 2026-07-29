/**
 * Paddle.js loading and checkout.
 *
 * This is the only file in the frontend that knows a payment processor exists.
 * Pages ask {@link openCheckout} to take a {@link CheckoutHandle} the API
 * produced and turn it into a payment; whether that means an overlay or a
 * navigation is decided here, not by the page.
 *
 * Nothing secret is involved. The client token is publishable — it identifies
 * the seller account and can only open a checkout for a transaction the server
 * already created and priced. A tampered client cannot choose what it pays.
 */
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { PaymentProvider } from '@rooferslabs/shared';
import type { BillingConfig, CheckoutHandle } from '@/types/api';

/**
 * The initialized SDK, cached across calls.
 *
 * Paddle.js injects a script and sets up global state, so initializing twice on
 * a client-side navigation would be wasteful and can double-register handlers.
 * The *promise* is cached rather than the result, so two components mounting in
 * the same tick share one load instead of racing.
 */
let paddlePromise: Promise<Paddle | undefined> | null = null;

export function loadPaddle(config: BillingConfig): Promise<Paddle | undefined> {
  paddlePromise ??= initializePaddle({
    token: config.clientToken,
    environment: config.environment === 'production' ? 'production' : 'sandbox',
  });
  return paddlePromise;
}

/** Test seam — resets the module-level cache between cases. */
export function resetPaddleForTests(): void {
  paddlePromise = null;
}

export class CheckoutError extends Error {}

/**
 * Take the browser to payment.
 *
 * Prefers the provider's in-page checkout, because sending someone away from
 * the application mid-signup is where funnels lose people. A plain URL is the
 * fallback, and is what a provider without a browser SDK (or a blocked script)
 * ends up using.
 *
 * Resolves when the checkout has been *opened*, not when it has been paid:
 * payment completion arrives asynchronously by webhook, and the billing page
 * polls for it. Nothing here should ever be treated as proof of payment.
 */
export async function openCheckout(handle: CheckoutHandle, config: BillingConfig): Promise<void> {
  if (handle.provider === PaymentProvider.PADDLE && handle.transactionId && config.clientToken) {
    const paddle = await loadPaddle(config);
    if (paddle) {
      paddle.Checkout.open({
        transactionId: handle.transactionId,
        // Paddle takes the post-payment destination from the browser rather
        // than from the transaction, so the server-chosen URL is applied here.
        settings: { successUrl: handle.successUrl },
      });
      return;
    }
    // Paddle.js failed to load — an ad blocker, an offline CDN. Fall through to
    // the hosted URL rather than leaving the tenant on a dead button.
  }

  if (handle.url) {
    // A full navigation, not a client-side route.
    window.location.assign(handle.url);
    return;
  }

  throw new CheckoutError('Could not open the checkout. Please try again.');
}
