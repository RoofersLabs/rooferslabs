/**
 * Stripe → domain translation.
 *
 * Preserved verbatim in behaviour from before the provider port existed, so that
 * re-enabling Stripe is a configuration change rather than an archaeology
 * exercise. Pure functions over plain data, and — importantly — `import type`
 * only, so this file contributes nothing to the runtime graph.
 */
import type Stripe from 'stripe';
import { InvoiceStatus, PaymentProvider, SubscriptionStatus } from '@rooferslabs/shared';
import type { ProviderInvoice, ProviderSubscription } from '../../types/billing.types';

/** Stripe subscription statuses → our persisted enum. */
export const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  unpaid: SubscriptionStatus.UNPAID,
  paused: SubscriptionStatus.PAUSED,
};

const INVOICE_STATUS_MAP: Record<string, InvoiceStatus> = {
  draft: InvoiceStatus.DRAFT,
  open: InvoiceStatus.OPEN,
  paid: InvoiceStatus.PAID,
  void: InvoiceStatus.VOID,
  uncollectible: InvoiceStatus.UNCOLLECTIBLE,
};

/** Stripe timestamps are epoch seconds. */
export const toDate = (seconds: number | null | undefined): Date | null =>
  typeof seconds === 'number' ? new Date(seconds * 1000) : null;

const idOf = (value: string | { id: string } | null | undefined): string | null => {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
};

export function toProviderSubscription(subscription: Stripe.Subscription): ProviderSubscription {
  const item = subscription.items.data[0];
  return {
    provider: PaymentProvider.STRIPE,
    providerCustomerId: idOf(subscription.customer) ?? '',
    providerSubscriptionId: subscription.id,
    providerPriceId: item?.price?.id ?? null,
    companyId: subscription.metadata?.companyId ?? null,
    status: STATUS_MAP[subscription.status] ?? SubscriptionStatus.NONE,
    plan: null, // Resolved from the price id by the adapter.
    interval: null,
    // In the Basil API the billing period moved onto the subscription item.
    currentPeriodEnd: toDate(item?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
    trialEndsAt: toDate(subscription.trial_end),
  };
}

/** In the Basil API the owning subscription hangs off `invoice.parent`. */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const details = invoice.parent?.subscription_details;
  if (!details) return null;
  return idOf(details.subscription);
}

export function toProviderInvoice(invoice: Stripe.Invoice): ProviderInvoice {
  return {
    provider: PaymentProvider.STRIPE,
    providerInvoiceId: invoice.id ?? '',
    providerCustomerId: idOf(invoice.customer),
    providerSubscriptionId: subscriptionIdFromInvoice(invoice),
    number: invoice.number ?? null,
    status: (invoice.status && INVOICE_STATUS_MAP[invoice.status]) || InvoiceStatus.DRAFT,
    currency: (invoice.currency ?? 'usd').toUpperCase(),
    amountDue: invoice.amount_due ?? 0,
    amountPaid: invoice.amount_paid ?? 0,
    issuedAt: toDate(invoice.created),
    paidAt: invoice.status === 'paid' ? toDate(invoice.status_transitions?.paid_at) : null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
  };
}
