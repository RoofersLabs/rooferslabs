/**
 * PayPal catalogue administration — products and billing plans.
 *
 * Separate from `paypal.subscriptions.ts` because these calls do something
 * categorically different: they change what is *for sale*, not what a customer
 * has bought. Nothing on a request path calls into this file; only the
 * provisioner does.
 *
 * Every operation here is a lookup-then-create, never a blind create. That is
 * what makes `billing:paypal:setup` safe to run repeatedly, and safe to run
 * against an account that already has the objects.
 */
import { Injectable, Logger } from '@nestjs/common';
import { describe, PayPalClient } from './paypal.client';

/** A product as PayPal stores it. */
export interface PayPalProduct {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
}

/** A billing plan as PayPal stores it. */
export interface PayPalPlan {
  id: string;
  product_id?: string;
  name: string;
  description?: string;
  status?: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  billing_cycles?: {
    tenure_type?: string;
    sequence?: number;
    frequency?: { interval_unit?: string; interval_count?: number };
    pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } };
  }[];
}

interface ProductList {
  products?: PayPalProduct[];
  total_pages?: number;
}

interface PlanList {
  plans?: PayPalPlan[];
  total_pages?: number;
}

/** PayPal caps a page at 20 for both listings. */
const PAGE_SIZE = 20;

/**
 * How many pages a listing will walk before giving up.
 *
 * A merchant account with hundreds of products is not this application's, and
 * scanning forever on a paginated endpoint that mis-reports `total_pages` is a
 * worse failure than not finding a match — the caller falls back to creating,
 * and the deterministic product id keeps even that idempotent.
 */
const MAX_PAGES = 25;

@Injectable()
export class PayPalCatalog {
  private readonly logger = new Logger(PayPalCatalog.name);

  constructor(private readonly client: PayPalClient) {}

  // ── Products ─────────────────────────────────────────────────────────────

  /**
   * Fetch a product by id, or null when it does not exist.
   *
   * A 404 is an answer, not a failure — it is the normal result on a fresh
   * account and the signal to create.
   */
  async getProduct(productId: string): Promise<PayPalProduct | null> {
    try {
      return await this.client.request<PayPalProduct>(
        'GET',
        `/v1/catalogs/products/${encodeURIComponent(productId)}`,
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** Walk the product list looking for one with this exact name. */
  async findProductByName(name: string): Promise<PayPalProduct | null> {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.client.request<ProductList>(
        'GET',
        `/v1/catalogs/products?page_size=${PAGE_SIZE}&page=${page}&total_required=true`,
      );
      const products = result?.products ?? [];
      const match = products.find((product) => product.name === name);
      if (match) return match;

      if (products.length < PAGE_SIZE) return null;
      if (result?.total_pages && page >= result.total_pages) return null;
    }
    this.logger.warn(`Stopped scanning products after ${MAX_PAGES} pages looking for "${name}".`);
    return null;
  }

  /**
   * Create a product, naming its id ourselves.
   *
   * PayPal accepts a caller-supplied product id, which is what makes this
   * operation genuinely idempotent rather than merely guarded: a second call
   * with the same id conflicts instead of quietly minting a duplicate, and the
   * caller re-reads the existing one. Plans get no such courtesy — PayPal
   * always generates a `P-…` — which is why they are matched by name instead.
   */
  async createProduct(input: {
    id: string;
    name: string;
    description: string;
    type: string;
    category: string;
  }): Promise<PayPalProduct> {
    return this.client.request<PayPalProduct>(
      'POST',
      '/v1/catalogs/products',
      {
        id: input.id,
        name: input.name,
        description: input.description,
        type: input.type,
        category: input.category,
      },
      { 'PayPal-Request-Id': `product-${input.id}` },
    );
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  async getPlan(planId: string): Promise<PayPalPlan | null> {
    try {
      return await this.client.request<PayPalPlan>(
        'GET',
        `/v1/billing/plans/${encodeURIComponent(planId)}`,
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** Every plan belonging to a product, across pages. */
  async listPlans(productId: string): Promise<PayPalPlan[]> {
    const all: PayPalPlan[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.client.request<PlanList>(
        'GET',
        `/v1/billing/plans?product_id=${encodeURIComponent(productId)}` +
          `&page_size=${PAGE_SIZE}&page=${page}&total_required=true`,
      );
      const plans = result?.plans ?? [];
      all.push(...plans);

      if (plans.length < PAGE_SIZE) break;
      if (result?.total_pages && page >= result.total_pages) break;
    }
    return all;
  }

  /**
   * Create a recurring billing plan.
   *
   * `total_cycles: 0` on the regular cycle is PayPal's way of saying "renew
   * forever", which is what a subscription is. `setup_fee_failure_action:
   * CANCEL` means a subscription whose very first payment fails does not linger
   * in a half-created state.
   *
   * The `PayPal-Request-Id` header is PayPal's idempotency key: it stores them
   * for 72 hours, so a retried create inside that window returns the original
   * plan rather than a second one. It is derived from the catalogue key and the
   * fingerprint, so re-running setup after a *price change* is correctly treated
   * as a different request.
   */
  async createPlan(input: {
    productId: string;
    name: string;
    description: string;
    intervalUnit: 'MONTH' | 'YEAR';
    amount: string;
    currency: string;
    autoRenew: boolean;
    paymentFailureThreshold: number;
    requestId: string;
  }): Promise<PayPalPlan> {
    return this.client.request<PayPalPlan>(
      'POST',
      '/v1/billing/plans',
      {
        product_id: input.productId,
        name: input.name,
        description: input.description,
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: { interval_unit: input.intervalUnit, interval_count: 1 },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: input.autoRenew ? 0 : 1,
            pricing_scheme: {
              fixed_price: { value: input.amount, currency_code: input.currency },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee_failure_action: 'CANCEL',
          payment_failure_threshold: input.paymentFailureThreshold,
        },
      },
      { 'PayPal-Request-Id': input.requestId },
    );
  }

  /**
   * Whether a plan at PayPal still matches what the catalogue asks for.
   *
   * Compared on the two things that decide what a customer is charged. A plan
   * that has drifted is reported, never rewritten: PayPal will not change the
   * price of a plan with live subscriptions, and silently continuing to sell the
   * old one is exactly the surprise this check exists to surface.
   */
  planMatches(
    plan: PayPalPlan,
    expected: { amount: string; currency: string; intervalUnit: string },
  ): boolean {
    const regular = plan.billing_cycles?.find((cycle) => cycle.tenure_type === 'REGULAR');
    const price = regular?.pricing_scheme?.fixed_price;
    if (!price) return false;

    return (
      Number(price.value) === Number(expected.amount) &&
      (price.currency_code ?? '').toUpperCase() === expected.currency.toUpperCase() &&
      (regular?.frequency?.interval_unit ?? '') === expected.intervalUnit
    );
  }
}

/**
 * Whether a failure was PayPal saying "no such object".
 *
 * The SDK's transport surfaces the status in the error message, so this matches
 * on it. A false negative simply means the error propagates, which is the safe
 * direction — the alternative, treating a real failure as "not found", would
 * make the provisioner create a duplicate.
 */
export function isNotFound(error: unknown): boolean {
  if (error instanceof Error && (error as { statusCode?: number }).statusCode === 404) return true;
  return /\b404\b|RESOURCE_NOT_FOUND|INVALID_RESOURCE_ID/i.test(describe(error));
}
