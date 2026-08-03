/**
 * The PayPal JS SDK, loaded once and typed minimally.
 *
 * Only the sliver of the SDK this application uses is declared — the two
 * button funding sources and the subscription lifecycle callbacks. The SDK is
 * a remote script whose surface changes without our package.json knowing, so a
 * narrow hand-written type is more honest than a stale community typing.
 *
 * The script URL carries `vault=true&intent=subscription`, which tells the SDK
 * to render only funding sources the merchant account can actually vault for
 * recurring billing. That gating is PayPal's, applied per account: a source the
 * account cannot subscribe through simply reports ineligible, and the page
 * renders whatever remains rather than a button that dies on approval.
 */

export interface PayPalSubscriptionActions {
  subscription: {
    /** Not used — subscriptions are created server-side. Declared for the type's honesty. */
    create: (options: Record<string, unknown>) => Promise<string>;
  };
}

export interface PayPalButtonsConfig {
  fundingSource?: string;
  style?: {
    layout?: 'vertical' | 'horizontal';
    color?: 'gold' | 'blue' | 'silver' | 'black' | 'white';
    shape?: 'rect' | 'pill';
    label?: 'paypal' | 'subscribe' | 'pay';
    height?: number;
  };
  /** Return the provider subscription id. Ours comes from the API, never built in the browser. */
  createSubscription: (data: unknown, actions: PayPalSubscriptionActions) => Promise<string>;
  onApprove: (data: { subscriptionID?: string | null }) => Promise<void> | void;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}

export interface PayPalButtons {
  isEligible: () => boolean;
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

export interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => PayPalButtons;
  FUNDING: { PAYPAL: string; CARD: string };
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

const SDK_ID = 'paypal-sdk';

let pending: Promise<PayPalNamespace> | null = null;

/**
 * Load the SDK for a client id, resolving with the global namespace.
 *
 * Idempotent: concurrent callers share one script tag and one promise, and a
 * remount after success resolves immediately from `window.paypal`. A failed
 * load clears the memo so a retry actually retries instead of replaying the
 * cached rejection forever.
 */
export function loadPayPalSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (pending) return pending;

  pending = new Promise<PayPalNamespace>((resolve, reject) => {
    const existing = document.getElementById(SDK_ID);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = SDK_ID;
    const params = new URLSearchParams({
      'client-id': clientId,
      vault: 'true',
      intent: 'subscription',
      // Only the buttons component: no card-fields, no marks, no messaging —
      // each extra component is more remote script for no rendered pixel.
      components: 'buttons',
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;

    script.onload = () => {
      if (window.paypal) {
        resolve(window.paypal);
      } else {
        pending = null;
        reject(new Error('The PayPal SDK loaded but did not initialize.'));
      }
    };
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error('The PayPal SDK could not be loaded.'));
    };

    document.head.appendChild(script);
  });

  return pending;
}
