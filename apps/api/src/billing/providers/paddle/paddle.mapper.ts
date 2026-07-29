/**
 * Paddle → domain translation.
 *
 * Every function here is pure and takes plain data, which is what makes the
 * mapping unit-testable without a Paddle account or a network. The adapter does
 * the talking; this file does the understanding.
 */
import type {
  Subscription as PaddleSubscription,
  Transaction as PaddleTransaction,
} from '@paddle/paddle-node-sdk';
import {
  BillingInterval,
  InvoiceStatus,
  PaymentProvider,
  SubscriptionStatus,
} from '@rooferslabs/shared';
import type { ProviderInvoice, ProviderSubscription } from '../../types/billing.types';

/**
 * Paddle's subscription statuses → ours.
 *
 * Paddle has a smaller vocabulary than our enum: there is no `incomplete` or
 * `unpaid`, because a Paddle subscription does not exist until its first
 * payment succeeds. The states it does not use simply never appear.
 */
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  trialing: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  paused: SubscriptionStatus.PAUSED,
  canceled: SubscriptionStatus.CANCELED,
};

/**
 * Paddle transaction statuses → invoice states.
 *
 * `billed` is Paddle's "issued and awaiting payment", which is what everyone
 * else calls an open invoice. `completed` means paid and settled.
 */
const INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  draft: InvoiceStatus.DRAFT,
  ready: InvoiceStatus.DRAFT,
  billed: InvoiceStatus.OPEN,
  completed: InvoiceStatus.PAID,
  canceled: InvoiceStatus.VOID,
  past_due: InvoiceStatus.UNCOLLECTIBLE,
};

export const toStatus = (status: string | null | undefined): SubscriptionStatus =>
  (status && STATUS_MAP[status]) || SubscriptionStatus.NONE;

export const toInvoiceStatus = (status: string | null | undefined): InvoiceStatus =>
  (status && INVOICE_STATUS_MAP[status]) || InvoiceStatus.DRAFT;

/** Paddle sends RFC 3339 strings; the domain works in Dates. */
export const toDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Paddle bills in a `{ interval, frequency }` pair rather than a single enum.
 * Anything that renews yearly — including a 12-month cadence — is annual.
 */
export function toBillingInterval(
  cycle: { interval?: string | null; frequency?: number | null } | null | undefined,
): BillingInterval | null {
  if (!cycle?.interval) return null;
  switch (cycle.interval) {
    case 'year':
      return BillingInterval.YEAR;
    case 'month':
      return (cycle.frequency ?? 1) >= 12 ? BillingInterval.YEAR : BillingInterval.MONTH;
    case 'week':
    case 'day':
      return BillingInterval.MONTH;
    default:
      return null;
  }
}

/**
 * Read the tenant reference we attached when the checkout was created.
 *
 * Paddle echoes `customData` back on the subscription and on every event
 * derived from it, so this is the primary way an inbound webhook is matched to
 * a tenant — more reliable than the customer id, which only resolves if our
 * local row already exists.
 */
export function companyIdFromCustomData(customData: unknown): string | null {
  if (typeof customData !== 'object' || customData === null) return null;
  const value = (customData as Record<string, unknown>).companyId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Money crosses Paddle's wire as a minor-unit string. Never parse it as a float. */
export function toMinorUnits(amount: string | null | undefined): number {
  if (!amount) return 0;
  const parsed = Number.parseInt(amount, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normalize a Paddle subscription.
 *
 * `cancelAtPeriodEnd` is derived from Paddle's scheduled-change model rather
 * than a flag: Paddle records a pending cancellation as a `scheduledChange`
 * with `action: 'cancel'`, and removing that object is how a cancellation is
 * undone. A `pause` scheduled for the period end is treated the same way — from
 * the tenant's point of view access stops either way.
 */
export function toProviderSubscription(subscription: PaddleSubscription): ProviderSubscription {
  const item = subscription.items?.[0];
  const scheduledAction = subscription.scheduledChange?.action ?? null;
  const cancelAtPeriodEnd = scheduledAction === 'cancel' || scheduledAction === 'pause';

  return {
    provider: PaymentProvider.PADDLE,
    providerCustomerId: subscription.customerId,
    providerSubscriptionId: subscription.id,
    providerPriceId: item?.price?.id ?? null,
    companyId: companyIdFromCustomData(subscription.customData),
    status: toStatus(subscription.status),
    plan: null, // Resolved from the price id by the adapter, which holds the catalogue.
    interval: toBillingInterval(subscription.billingCycle),
    currentPeriodEnd: toDate(subscription.currentBillingPeriod?.endsAt),
    cancelAtPeriodEnd,
    canceledAt: toDate(subscription.canceledAt),
    trialEndsAt: toDate(item?.trialDates?.endsAt),
  };
}

/**
 * Normalize a Paddle transaction into an invoice.
 *
 * Paddle has no separate invoice object for subscription billing — a
 * transaction *is* the billing document, and carries the invoice number once it
 * has been issued. Totals come from `details.totals`, which is the authoritative
 * computed set (tax included); the per-item amounts are pre-tax and would
 * understate what the customer actually paid.
 */
export function toProviderInvoice(transaction: PaddleTransaction): ProviderInvoice {
  const totals = transaction.details?.totals;
  const grandTotal = toMinorUnits(totals?.grandTotal ?? totals?.total);
  const status = toInvoiceStatus(transaction.status);

  return {
    provider: PaymentProvider.PADDLE,
    providerInvoiceId: transaction.id,
    providerCustomerId: transaction.customerId ?? null,
    providerSubscriptionId: transaction.subscriptionId ?? null,
    number: transaction.invoiceNumber ?? null,
    status,
    currency: (transaction.currencyCode ?? 'USD').toUpperCase(),
    amountDue: grandTotal,
    // Paddle does not report a paid amount; a completed transaction is paid in
    // full by definition, and anything else has taken nothing.
    amountPaid: status === InvoiceStatus.PAID ? grandTotal : 0,
    issuedAt: toDate(transaction.billedAt ?? transaction.createdAt),
    paidAt: status === InvoiceStatus.PAID ? toDate(transaction.billedAt) : null,
    invoiceUrl: null, // Fetched on demand — Paddle's PDF links are short-lived.
  };
}
