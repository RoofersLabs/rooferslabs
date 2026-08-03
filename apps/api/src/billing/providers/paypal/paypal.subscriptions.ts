/**
 * PayPal subscription operations.
 *
 * A thin, typed layer over the REST endpoints, with no domain vocabulary in it —
 * `paypal.provider.ts` does the translating. Reads go through the raw request
 * helper because the SDK's generated model drops `status`; writes that only need
 * an acknowledgement use it too, so that one transport is used throughout and
 * failures look the same wherever they come from.
 */
import { Injectable } from '@nestjs/common';
import { PayPalClient } from './paypal.client';
import type { PayPalLink, PayPalSubscription } from './paypal.types';

export interface CreateSubscriptionOptions {
  planId: string;
  /** Our tenant reference, echoed back on the subscription and its events. */
  companyId: string;
  companyName: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
}

@Injectable()
export class PayPalSubscriptions {
  constructor(private readonly client: PayPalClient) {}

  /**
   * Create a subscription in `APPROVAL_PENDING` and return it with its approval
   * link.
   *
   * Nothing is charged here and the subscription does not yet entitle anyone to
   * anything — it becomes real when the payer approves it at PayPal and the
   * `BILLING.SUBSCRIPTION.ACTIVATED` webhook arrives.
   *
   * `custom_id` carries the tenant reference. It is the mechanism every later
   * webhook uses to find the company, which matters because PayPal has no
   * customer object for us to have stored an id against beforehand.
   *
   * `user_action: 'SUBSCRIBE_NOW'` makes PayPal's final button complete the
   * subscription rather than return the payer to a review step they would have
   * to confirm again. `shipping_preference: 'NO_SHIPPING'` suppresses the
   * address form — this is software, and asking a roofer for a shipping address
   * is both pointless and a place to abandon.
   */
  async create(options: CreateSubscriptionOptions): Promise<PayPalSubscription> {
    return this.client.request<PayPalSubscription>('POST', '/v1/billing/subscriptions', {
      plan_id: options.planId,
      custom_id: options.companyId,
      subscriber: {
        email_address: options.email,
        name: { given_name: options.companyName },
      },
      application_context: {
        brand_name: 'rooferslabs',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          // Instant-only: an eCheck can take days to clear, and a subscription
          // that activates on a payment that later bounces would hand out
          // service we then have to claw back.
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: options.returnUrl,
        cancel_url: options.cancelUrl,
      },
    });
  }

  async get(subscriptionId: string): Promise<PayPalSubscription> {
    return this.client.request<PayPalSubscription>(
      'GET',
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
  }

  /**
   * Move a subscription to a different plan.
   *
   * PayPal may require the payer to approve the change — it does whenever the
   * new plan costs more — and says so by returning an `approve` link. The caller
   * must send the browser there; until it is followed, the subscription stays on
   * its old plan. That is the one place PayPal's model is visibly different from
   * a processor that can raise a price server-side, and it is why `changePlan`
   * hands an approval URL back up to the frontend.
   */
  async revise(
    subscriptionId: string,
    planId: string,
    returnUrl: string,
    cancelUrl: string,
  ): Promise<{ approvalUrl: string | null }> {
    const response = await this.client.request<{ links?: PayPalLink[] }>(
      'POST',
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/revise`,
      {
        plan_id: planId,
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: 'SUBSCRIBE_NOW',
        },
      },
    );
    return { approvalUrl: approvalLink(response?.links) };
  }

  /**
   * Pause billing without ending the subscription.
   *
   * This is how a cancel-at-period-end is honoured: PayPal has no scheduled
   * cancellation, and its `cancel` is immediate and irreversible, so suspending
   * stops any further charge while leaving the subscription reinstatable if the
   * tenant changes their mind. See `paypal.provider.ts`.
   */
  async suspend(subscriptionId: string, reason: string): Promise<void> {
    await this.client.request<void>(
      'POST',
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/suspend`,
      { reason },
    );
  }

  /** Undo a suspension and resume billing on the existing cycle. */
  async activate(subscriptionId: string, reason: string): Promise<void> {
    await this.client.request<void>(
      'POST',
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/activate`,
      { reason },
    );
  }

  /** End a subscription for good. PayPal offers no way back from this. */
  async cancel(subscriptionId: string, reason: string): Promise<void> {
    await this.client.request<void>(
      'POST',
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { reason },
    );
  }
}

/**
 * The link PayPal wants the browser sent to.
 *
 * Present on a newly created subscription, and on a revision that needs the
 * payer's consent. Absent when no approval is required.
 */
export function approvalLink(links: PayPalLink[] | undefined): string | null {
  return links?.find((link) => link.rel === 'approve')?.href ?? null;
}
