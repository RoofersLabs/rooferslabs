/**
 * The shapes PayPal actually puts on the wire.
 *
 * Hand-written rather than imported from the SDK because the generated models
 * are lossy in exactly the places this integration depends on — most
 * importantly `status`, which APIMATIC's mapper drops from every subscription
 * read. See the note in `paypal.client.ts`.
 *
 * These are wire types in snake_case, deliberately mirroring the REST payloads.
 * Nothing outside this directory imports them: `paypal.mapper.ts` turns them
 * into the provider-neutral vocabulary in `../../types/billing.types.ts`.
 */

/**
 * PayPal's subscription lifecycle.
 *
 * `APPROVAL_PENDING` is the state a subscription is created in — it exists but
 * the payer has not yet approved it at PayPal. `APPROVED` means they approved
 * but the first payment has not settled.
 */
export type PayPalSubscriptionStatus =
  'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

export interface PayPalMoney {
  currency_code: string;
  value: string;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalSubscription {
  id: string;
  plan_id?: string;
  status: PayPalSubscriptionStatus;
  status_update_time?: string;
  start_time?: string;
  create_time?: string;
  update_time?: string;
  /**
   * Our tenant reference, set at creation. This is how an inbound webhook is
   * matched to a company without a lookup — PayPal echoes it back on every
   * subscription and every transaction derived from it.
   */
  custom_id?: string;
  subscriber?: {
    payer_id?: string;
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  billing_info?: {
    next_billing_time?: string;
    final_payment_time?: string;
    failed_payments_count?: number;
    outstanding_balance?: PayPalMoney;
    last_payment?: { amount?: PayPalMoney; time?: string };
    cycle_executions?: {
      tenure_type: 'TRIAL' | 'REGULAR';
      sequence: number;
      cycles_completed: number;
      cycles_remaining?: number;
    }[];
  };
  links?: PayPalLink[];
}

/** The envelope every webhook delivery arrives in. */
export interface PayPalWebhookEvent {
  id: string;
  event_version?: string;
  create_time: string;
  resource_type?: string;
  event_type: string;
  summary?: string;
  resource?: unknown;
}

/** The answer from `/v1/notifications/verify-webhook-signature`. */
export interface PayPalVerificationResult {
  verification_status: 'SUCCESS' | 'FAILURE';
}

/**
 * The subset of a `PAYMENT.SALE.*` resource we read.
 *
 * Sale events are the money events on a subscription: they name the
 * subscription through `billing_agreement_id`, which is what lets a payment be
 * attributed to a tenant.
 */
export interface PayPalSaleResource {
  id: string;
  state?: string;
  amount?: { total?: string; currency?: string };
  billing_agreement_id?: string;
  create_time?: string;
  update_time?: string;
  parent_payment?: string;
}
