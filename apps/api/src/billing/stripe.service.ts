import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SubscriptionPlan } from '@rooferslabs/shared';
import { ExternalServiceError, PaymentsDisabledError } from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';

/**
 * Adapter isolating Stripe. Nothing outside this file imports the Stripe SDK,
 * so the billing domain stays provider-agnostic (mirroring how TwilioService
 * isolates telephony). The secret key never leaves the server.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  constructor(private readonly config: AppConfigService) {}

  /** Whether billing is switched on platform-wide. */
  get isEnabled(): boolean {
    return this.config.payments.enabled;
  }

  get isConfigured(): boolean {
    return this.isEnabled && Boolean(this.config.stripe.secretKey);
  }

  /**
   * The Stripe client, constructed lazily so the app boots without billing keys
   * — and never constructed at all while PAYMENTS_ENABLED is off, so no Stripe
   * connection is opened and no key is read.
   */
  private get stripe(): Stripe {
    if (!this.isEnabled) {
      throw new PaymentsDisabledError();
    }
    if (!this.isConfigured) {
      throw new ExternalServiceError('Billing is not configured. Set STRIPE_SECRET_KEY.');
    }
    this.client ??= new Stripe(this.config.stripe.secretKey, {
      // Pin the API version: an account-level upgrade must never silently
      // change payload shapes under a running deployment.
      apiVersion: '2025-08-27.basil',
      typescript: true,
      appInfo: { name: 'RoofersLabs', version: '1.0.0' },
      maxNetworkRetries: 2,
    });
    return this.client;
  }

  /** Resolve the configured Stripe Price ID for a plan. */
  priceIdFor(plan: SubscriptionPlan): string {
    const priceId = this.config.stripe.prices[plan];
    if (!priceId) {
      throw new ExternalServiceError(`No Stripe price is configured for the ${plan} plan.`);
    }
    return priceId;
  }

  /** Reverse lookup used by webhooks to label a subscription with our plan. */
  planForPriceId(priceId: string | null | undefined): SubscriptionPlan | null {
    if (!priceId) return null;
    const match = Object.entries(this.config.stripe.prices).find(([, id]) => id === priceId);
    return match ? (match[0] as SubscriptionPlan) : null;
  }

  /**
   * Create (or reuse) the Stripe customer representing a tenant. The company id
   * is written to metadata so a Stripe-side event can always be traced back to
   * the tenant even if our local record is missing.
   */
  async createCustomer(params: {
    companyId: string;
    companyName: string;
    email: string | null;
  }): Promise<string> {
    const customer = await this.stripe.customers.create({
      name: params.companyName,
      ...(params.email ? { email: params.email } : {}),
      metadata: { companyId: params.companyId },
    });
    this.logger.log(`Created Stripe customer ${customer.id} for company ${params.companyId}`);
    return customer.id;
  }

  /** Whether a customer still exists in Stripe (guards against deleted test data). */
  async customerExists(customerId: string): Promise<boolean> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      return !customer.deleted;
    } catch {
      return false;
    }
  }

  /** Start a subscription Checkout session for a tenant. */
  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    companyId: string;
    successUrl: string;
    cancelUrl: string;
    trialPeriodDays: number;
  }): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: params.companyId,
      // Metadata is mirrored onto the subscription so every webhook — including
      // ones that arrive without the session — can resolve the tenant.
      metadata: { companyId: params.companyId },
      subscription_data: {
        metadata: { companyId: params.companyId },
        ...(params.trialPeriodDays > 0 ? { trial_period_days: params.trialPeriodDays } : {}),
      },
    });
  }

  /** Open the hosted Customer Portal (payment methods, invoices, cancellation). */
  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /** Cancel at period end — the tenant keeps access until the paid term expires. */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }

  /** Undo a pending cancellation before the period ends. */
  async resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
  }

  /**
   * Verify a webhook payload against the signing secret. The raw (unparsed)
   * body is required — any re-serialization invalidates the signature.
   */
  constructWebhookEvent(rawBody: Buffer | string, signature: string | undefined): Stripe.Event {
    if (!this.isEnabled) {
      throw new PaymentsDisabledError();
    }
    const secret = this.config.stripe.webhookSecret;
    if (!secret) {
      throw new ExternalServiceError('Billing webhooks are not configured.');
    }
    if (!signature) {
      throw new ExternalServiceError('Missing Stripe signature header.');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
