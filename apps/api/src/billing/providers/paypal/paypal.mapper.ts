/**
 * PayPal → domain translation.
 *
 * Every function here is pure and takes plain data, which is what makes the
 * mapping unit-testable without a PayPal account or a network. The adapter does
 * the talking; this file does the understanding.
 */
import { InvoiceStatus, PaymentProvider, SubscriptionStatus } from '@rooferslabs/shared';
import type { ProviderInvoice, ProviderSubscription } from '../../types/billing.types';
import type {
  PayPalSaleResource,
  PayPalSubscription,
  PayPalSubscriptionStatus,
} from './paypal.types';

/**
 * PayPal's subscription statuses → ours.
 *
 * Two mappings are worth explaining:
 *
 *  - `APPROVAL_PENDING` and `APPROVED` both become `INCOMPLETE`. The
 *    subscription exists at PayPal but no money has moved: the payer has either
 *    not finished approving it, or has approved it and the first payment has not
 *    settled. Neither entitles a tenant to service, and `INCOMPLETE` is exactly
 *    the domain's word for that.
 *  - `SUSPENDED` becomes `PAUSED`. PayPal suspends for two very different
 *    reasons — repeated payment failure, or because *we* suspended it to honour
 *    a cancel-at-period-end — and this mapping cannot tell them apart from the
 *    payload alone. `BillingService` reconciles that against the local
 *    `cancelAtPeriodEnd` flag; see its `reconcilePendingCancellation`.
 */
const STATUS_MAP: Record<PayPalSubscriptionStatus, SubscriptionStatus> = {
  APPROVAL_PENDING: SubscriptionStatus.INCOMPLETE,
  APPROVED: SubscriptionStatus.INCOMPLETE,
  ACTIVE: SubscriptionStatus.ACTIVE,
  SUSPENDED: SubscriptionStatus.PAUSED,
  CANCELLED: SubscriptionStatus.CANCELED,
  EXPIRED: SubscriptionStatus.CANCELED,
};

/**
 * PayPal sale states → invoice states.
 *
 * These are PayPal's own words, not a generic payments vocabulary: a rejected
 * charge is `denied`, never "declined" or "failed". A sale is only reported once
 * it has been attempted, so there is no draft state to model.
 *
 * `partially_refunded` stays PAID — money did change hands, and the tenant's
 * history should show the charge rather than hiding it behind a partial credit.
 */
const INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  COMPLETED: InvoiceStatus.PAID,
  PARTIALLY_REFUNDED: InvoiceStatus.PAID,
  REFUNDED: InvoiceStatus.VOID,
  REVERSED: InvoiceStatus.VOID,
  PENDING: InvoiceStatus.OPEN,
  DENIED: InvoiceStatus.UNCOLLECTIBLE,
  EXPIRED: InvoiceStatus.UNCOLLECTIBLE,
};

export const toStatus = (status: string | null | undefined): SubscriptionStatus =>
  (status && STATUS_MAP[status as PayPalSubscriptionStatus]) || SubscriptionStatus.NONE;

export const toInvoiceStatus = (status: string | null | undefined): InvoiceStatus =>
  (status && INVOICE_STATUS_MAP[status.toUpperCase()]) || InvoiceStatus.OPEN;

/** PayPal sends RFC 3339 strings; the domain works in Dates. */
export const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Money crosses PayPal's wire as a decimal string — `"49.00"`, not `4900`.
 *
 * This is the opposite convention to the one the domain stores in, so the
 * conversion is explicit and rounded rather than truncated: `Math.round` on the
 * scaled value avoids the classic `49.99 * 100 = 4998.9999…` floor.
 */
export function toMinorUnits(amount: string | null | undefined): number {
  if (!amount) return 0;
  const parsed = Number.parseFloat(amount);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/**
 * Whether a subscription is inside a trial cycle right now.
 *
 * PayPal reports trials as a cycle execution with `tenure_type: 'TRIAL'` that
 * still has cycles remaining, rather than as a status or an end date.
 */
export function isTrialing(subscription: PayPalSubscription): boolean {
  const trial = subscription.billing_info?.cycle_executions?.find(
    (cycle) => cycle.tenure_type === 'TRIAL',
  );
  if (!trial) return false;
  return (trial.cycles_remaining ?? 0) > 0;
}

/**
 * The identity we store as `providerCustomerId`.
 *
 * PayPal has no customer object to create ahead of a subscription — there is
 * only a payer, and their id is not known until they have approved one. The
 * subscriber's `payer_id` is used when PayPal has told us what it is; before
 * approval it has not, and the subscription's own id stands in.
 *
 * That substitution is safe because the column is only ever used to *find* the
 * tenant's row again, never to call PayPal: the provider-scoped unique index
 * keeps it collision-free, and `resolveCustomerId` in BillingService re-reads it
 * rather than trusting it.
 */
export function toCustomerId(subscription: PayPalSubscription): string {
  return subscription.subscriber?.payer_id ?? subscription.id;
}

/**
 * Normalize a PayPal subscription.
 *
 * `currentPeriodEnd` comes from `next_billing_time`, which is what the tenant's
 * paid term actually runs to. On a cancelled or suspended subscription PayPal
 * stops sending it, so `final_payment_time` is the fallback — otherwise a
 * cancel-at-period-end would lose the very date that decides how long access
 * lasts.
 *
 * `cancelAtPeriodEnd` is deliberately NOT derived here. PayPal has no scheduled
 * cancellation to read: the intent lives in our own row, and only
 * `BillingService` knows it. Reporting `false` from the wire would clobber it.
 */
export function toProviderSubscription(
  subscription: PayPalSubscription,
  cancelAtPeriodEnd = false,
): ProviderSubscription {
  const billing = subscription.billing_info;
  const status = toStatus(subscription.status);

  return {
    provider: PaymentProvider.PAYPAL,
    providerCustomerId: toCustomerId(subscription),
    providerSubscriptionId: subscription.id,
    providerPriceId: subscription.plan_id ?? null,
    companyId: subscription.custom_id ?? null,
    status:
      status === SubscriptionStatus.ACTIVE && isTrialing(subscription)
        ? SubscriptionStatus.TRIALING
        : status,
    plan: null, // Resolved from the plan id by the adapter, which holds the catalogue.
    interval: null, // Same — the cadence is a property of the configured plan.
    currentPeriodEnd: toDate(billing?.next_billing_time ?? billing?.final_payment_time),
    cancelAtPeriodEnd,
    canceledAt:
      status === SubscriptionStatus.CANCELED ? toDate(subscription.status_update_time) : null,
    trialEndsAt: isTrialing(subscription) ? toDate(billing?.next_billing_time) : null,
  };
}

/**
 * Normalize a `PAYMENT.SALE.*` webhook resource into an invoice.
 *
 * PayPal's Invoicing API is a separate product for hand-issued invoices and has
 * nothing to do with subscriptions: the billing document for a subscription
 * cycle is its sale. `amount.total` is what the customer was actually charged,
 * where a net figure would be what reaches the merchant after PayPal's fee and
 * would understate the charge.
 *
 * Sale events name their subscription through `billing_agreement_id`, which is
 * how a payment is attributed to a tenant.
 */
export function saleToProviderInvoice(sale: PayPalSaleResource): ProviderInvoice {
  const amount = toMinorUnits(sale.amount?.total);
  const status = toInvoiceStatus(sale.state);
  const issuedAt = toDate(sale.create_time ?? sale.update_time);

  return {
    provider: PaymentProvider.PAYPAL,
    providerInvoiceId: sale.id,
    providerCustomerId: null,
    providerSubscriptionId: sale.billing_agreement_id ?? null,
    number: sale.id,
    status,
    currency: (sale.amount?.currency ?? 'USD').toUpperCase(),
    amountDue: amount,
    amountPaid: status === InvoiceStatus.PAID ? amount : 0,
    issuedAt,
    paidAt: status === InvoiceStatus.PAID ? issuedAt : null,
    invoiceUrl: null,
  };
}
