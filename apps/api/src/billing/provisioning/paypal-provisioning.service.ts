/**
 * The provisioner: makes PayPal match the catalogue, then records what it made.
 *
 * This is what `npm run billing:paypal:setup` runs. It is the only thing in the
 * application allowed to create objects at PayPal, and it is deliberately not
 * wired into any request path — provisioning on demand would let a burst of
 * traffic race to create the same plan, and would make what a customer is
 * charged depend on when they arrived.
 *
 * ## Idempotency
 *
 * Every step is lookup-then-create, at three layers, so the whole run converges
 * to the same state no matter how many times it is invoked or where a previous
 * run died:
 *
 *  1. **The persisted row.** If we already recorded an id, verify it still
 *     exists at PayPal and stop.
 *  2. **PayPal itself.** If the row is missing — fresh database, restored
 *     snapshot — find the object by its deterministic id (products) or by name
 *     (plans) or by URL (webhooks) before creating anything.
 *  3. **`PayPal-Request-Id`.** Every create carries one, so even a retry inside
 *     PayPal's 72-hour window returns the original object rather than a second.
 *
 * ## What it will not do
 *
 * It never edits or deletes an existing plan. PayPal will not change the price
 * of a plan that has live subscriptions, and quietly continuing to sell an old
 * price is precisely the surprise this system exists to prevent — so drift is
 * *reported* and the operator decides.
 */
import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval, PaymentProvider } from '@rooferslabs/shared';
import { AppConfigService } from '../../config/app-config.service';
import { PayPalCatalog } from '../providers/paypal/paypal.catalog';
import { PayPalClient } from '../providers/paypal/paypal.client';
import { PayPalWebhooksAdmin } from '../providers/paypal/paypal.webhooks-admin';
import { BillingCatalogRepository, type CatalogScope } from './billing-catalog.repository';
import {
  CATALOG_PLANS,
  CATALOG_PRODUCT,
  PRODUCT_CATALOG_KEY,
  WEBHOOK_CATALOG_KEY,
  WEBHOOK_EVENT_TYPES,
  type CatalogPlan,
  planCatalogKey,
  planFingerprint,
  productFingerprint,
} from './catalog.config';

/** What happened to one catalogue object during a run. */
export type ProvisionAction = 'created' | 'reused' | 'updated' | 'skipped' | 'failed';

export interface ProvisionStep {
  /** Human label, e.g. `plan:STARTER:MONTH` or `webhook`. */
  key: string;
  action: ProvisionAction;
  /** The provider-issued id, when there is one. */
  externalId?: string;
  /** What an operator needs to read. Never contains a credential. */
  detail: string;
  /**
   * Set when the object exists but no longer matches the catalogue. Not an
   * error — a decision for the operator.
   */
  drift?: string;
}

export interface ProvisionReport {
  ok: boolean;
  environment: string;
  webhookUrl: string;
  steps: ProvisionStep[];
  /** Anything that stopped the run. Empty on success. */
  errors: string[];
}

@Injectable()
export class PayPalProvisioningService {
  private readonly logger = new Logger(PayPalProvisioningService.name);

  constructor(
    private readonly client: PayPalClient,
    private readonly catalog: PayPalCatalog,
    private readonly webhooks: PayPalWebhooksAdmin,
    private readonly repo: BillingCatalogRepository,
    private readonly config: AppConfigService,
  ) {}

  private get scope(): CatalogScope {
    return {
      provider: PaymentProvider.PAYPAL,
      environment: this.config.paypal.environment,
    };
  }

  /** Where PayPal should deliver webhooks for this deployment. */
  get webhookUrl(): string {
    return `${this.config.api.publicUrl.replace(/\/+$/, '')}/v1/billing/webhook/paypal`;
  }

  /**
   * Run the whole provisioning sequence.
   *
   * Ordered by dependency: credentials before anything, the product before its
   * plans, and the webhook last because it is independent and its failure mode
   * (an unreachable URL in local development) should not stop the catalogue from
   * being created.
   */
  async provision(): Promise<ProvisionReport> {
    const report: ProvisionReport = {
      ok: true,
      environment: this.config.paypal.environment,
      webhookUrl: this.webhookUrl,
      steps: [],
      errors: [],
    };

    // ── Credentials ────────────────────────────────────────────────────────
    if (!this.client.isConfigured) {
      report.ok = false;
      report.errors.push(
        'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set. Nothing can be provisioned without them.',
      );
      return report;
    }

    const access = await this.client.verifyAccess();
    if (!access.ok) {
      report.ok = false;
      report.errors.push(
        access.stage === 'auth'
          ? `PayPal rejected the credentials: ${access.detail}. Check PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET, ` +
              `and that they belong to the ${this.config.paypal.environment} estate.`
          : `PayPal authenticated but refused a catalogue read: ${access.detail}. The REST app is likely ` +
              `missing the Subscriptions capability — enable it in the Developer Dashboard.`,
      );
      return report;
    }
    report.steps.push({
      key: 'credentials',
      action: 'reused',
      detail: `Authenticated against PayPal ${this.config.paypal.environment}.`,
    });

    // ── Product ────────────────────────────────────────────────────────────
    let productId: string;
    try {
      const product = await this.provisionProduct();
      productId = product.externalId!;
      report.steps.push(product);
    } catch (error) {
      report.ok = false;
      report.errors.push(`Could not provision the product: ${describeError(error)}`);
      return report;
    }

    // ── Plans ──────────────────────────────────────────────────────────────
    for (const plan of CATALOG_PLANS) {
      try {
        report.steps.push(await this.provisionPlan(productId, plan));
      } catch (error) {
        report.ok = false;
        const step: ProvisionStep = {
          key: planCatalogKey(plan.plan, plan.interval, plan.pricingMode),
          action: 'failed',
          detail: describeError(error),
        };
        report.steps.push(step);
        report.errors.push(`Could not provision plan "${plan.name}": ${describeError(error)}`);
      }
    }

    // ── Webhook ────────────────────────────────────────────────────────────
    try {
      report.steps.push(await this.provisionWebhook());
    } catch (error) {
      report.ok = false;
      report.steps.push({
        key: WEBHOOK_CATALOG_KEY,
        action: 'failed',
        detail: describeError(error),
      });
      report.errors.push(`Could not provision the webhook: ${describeError(error)}`);
    }

    return report;
  }

  // ── Product ──────────────────────────────────────────────────────────────

  /**
   * The product id this deployment uses.
   *
   * Deterministic and environment-qualified, so a sandbox run and a live run
   * never collide, and so a re-run finds the object by a straight GET rather
   * than by scanning a paginated list. PayPal accepts a caller-supplied product
   * id, which is what makes this possible.
   */
  private get deterministicProductId(): string {
    const suffix = this.config.paypal.environment === 'live' ? 'LIVE' : 'SBX';
    return `RL-${CATALOG_PRODUCT.key.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${suffix}`;
  }

  private async provisionProduct(): Promise<ProvisionStep> {
    const key = PRODUCT_CATALOG_KEY;
    const fingerprint = productFingerprint(CATALOG_PRODUCT);

    // 1. What we recorded last time, if it still exists.
    const recorded = await this.repo.find(this.scope, key);
    if (recorded) {
      const live = await this.catalog.getProduct(recorded.externalId);
      if (live) {
        return {
          key,
          action: 'reused',
          externalId: live.id,
          detail: `Product "${live.name}" already provisioned.`,
        };
      }
      this.logger.warn(
        `Recorded product ${recorded.externalId} no longer exists at PayPal; re-provisioning.`,
      );
    }

    // 2. PayPal itself — by deterministic id, then by name.
    const byId = await this.catalog.getProduct(this.deterministicProductId);
    const existing = byId ?? (await this.catalog.findProductByName(CATALOG_PRODUCT.name));
    if (existing) {
      await this.repo.upsert(this.scope, {
        key,
        externalId: existing.id,
        fingerprint,
        metadata: { name: existing.name, type: existing.type ?? CATALOG_PRODUCT.type },
      });
      return {
        key,
        action: 'reused',
        externalId: existing.id,
        detail: `Adopted existing product "${existing.name}" (${existing.id}).`,
      };
    }

    // 3. Create.
    const created = await this.catalog.createProduct({
      id: this.deterministicProductId,
      name: CATALOG_PRODUCT.name,
      description: CATALOG_PRODUCT.description,
      type: CATALOG_PRODUCT.type,
      category: CATALOG_PRODUCT.category,
    });

    await this.repo.upsert(this.scope, {
      key,
      externalId: created.id,
      fingerprint,
      metadata: { name: created.name, type: CATALOG_PRODUCT.type },
    });

    return {
      key,
      action: 'created',
      externalId: created.id,
      detail: `Created product "${CATALOG_PRODUCT.name}" (${created.id}).`,
    };
  }

  // ── Plans ────────────────────────────────────────────────────────────────

  private async provisionPlan(productId: string, plan: CatalogPlan): Promise<ProvisionStep> {
    const key = planCatalogKey(plan.plan, plan.interval, plan.pricingMode);
    const fingerprint = planFingerprint(plan);
    const intervalUnit = plan.interval === BillingInterval.YEAR ? 'YEAR' : 'MONTH';
    const expected = { amount: plan.amount, currency: plan.currency, intervalUnit };

    const metadata = {
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      plan: plan.plan,
    };

    // 1. What we recorded last time.
    const recorded = await this.repo.find(this.scope, key);
    if (recorded) {
      const live = await this.catalog.getPlan(recorded.externalId);
      if (live) {
        // The row exists and so does the plan. The only thing worth saying is
        // whether the catalogue has since been edited to describe something
        // different from what is actually being sold.
        const drift =
          recorded.fingerprint === fingerprint && this.catalog.planMatches(live, expected)
            ? undefined
            : `Plan ${live.id} bills ${priceOf(live)} but the catalogue now asks for ` +
              `${plan.amount} ${plan.currency}/${intervalUnit.toLowerCase()}. PayPal cannot reprice a plan ` +
              `with live subscriptions — add a new plan entry with a new key instead.`;

        return {
          key,
          action: 'reused',
          externalId: live.id,
          detail: `Plan "${plan.name}" already provisioned.`,
          drift,
        };
      }
      this.logger.warn(
        `Recorded plan ${recorded.externalId} no longer exists at PayPal; re-provisioning.`,
      );
    }

    // 2. PayPal itself. Plans get a generated id, so they are matched by name
    //    within the product — the closest thing to a stable handle available.
    const siblings = await this.catalog.listPlans(productId);
    const existing = siblings.find(
      (candidate) => candidate.name === plan.name && candidate.status !== 'INACTIVE',
    );
    if (existing) {
      await this.repo.upsert(this.scope, { key, externalId: existing.id, fingerprint, metadata });

      // The list endpoint returns a summary: it carries id, name and status but
      // no `billing_cycles`, so comparing prices against it reports drift for
      // every adoption and reads the amount as unreadable. Re-read the plan in
      // full before saying anything about what it charges — an adoption that
      // cannot see a price must not be the thing that tells you the price is
      // wrong. Falling back to the summary keeps a failed read from breaking the
      // run; it simply produces the same honest "unreadable" note.
      const full = (await this.catalog.getPlan(existing.id)) ?? existing;
      const drift = this.catalog.planMatches(full, expected)
        ? undefined
        : `Adopted plan ${existing.id} bills ${priceOf(full)}, not ${plan.amount} ${plan.currency}.`;
      return {
        key,
        action: 'reused',
        externalId: existing.id,
        detail: `Adopted existing plan "${plan.name}" (${existing.id}).`,
        drift,
      };
    }

    // 3. Create.
    const created = await this.catalog.createPlan({
      productId,
      name: plan.name,
      description: plan.description,
      intervalUnit,
      amount: plan.amount,
      currency: plan.currency,
      autoRenew: plan.autoRenew,
      paymentFailureThreshold: plan.paymentFailureThreshold,
      // Fingerprint in the key so a genuine catalogue change is a genuinely
      // different request rather than a replay of the previous one.
      requestId: `plan-${key}-${fingerprint}`.slice(0, 100),
    });

    await this.repo.upsert(this.scope, { key, externalId: created.id, fingerprint, metadata });

    return {
      key,
      action: 'created',
      externalId: created.id,
      detail: `Created plan "${plan.name}" at ${plan.amount} ${plan.currency}/${intervalUnit.toLowerCase()} (${created.id}).`,
    };
  }

  // ── Webhook ──────────────────────────────────────────────────────────────

  private async provisionWebhook(): Promise<ProvisionStep> {
    const key = WEBHOOK_CATALOG_KEY;
    const url = this.webhookUrl;
    const fingerprint = `v1:${[...WEBHOOK_EVENT_TYPES].sort().join(',')}`;

    // An explicitly configured id wins. Someone who registered a webhook by
    // hand, or who shares one across deployments, must not have it replaced.
    const override = this.config.paypal.webhookId;
    if (override) {
      await this.repo.upsert(this.scope, {
        key,
        externalId: override,
        fingerprint,
        metadata: { url, source: 'PAYPAL_WEBHOOK_ID' },
      });
      return {
        key,
        action: 'reused',
        externalId: override,
        detail: `Using the webhook id from PAYPAL_WEBHOOK_ID; not managing it automatically.`,
      };
    }

    const valid = PayPalWebhooksAdmin.validateUrl(url);
    if (!valid.ok) {
      return {
        key,
        action: 'skipped',
        detail:
          `Webhook not registered: ${valid.reason} ` +
          `The rest of the catalogue is provisioned; re-run setup once the API has a public HTTPS origin.`,
      };
    }

    const existing = await this.webhooks.findByUrl(url);
    if (existing) {
      const diff = this.webhooks.diffEventTypes(existing, WEBHOOK_EVENT_TYPES);
      let action: ProvisionAction = 'reused';
      let detail = `Webhook already registered for ${url}.`;

      // Only missing events are worth a write. Extra ones cost a verification
      // round-trip and are then ignored, which is wasteful but not incorrect —
      // and rewriting the list would clobber a subscription someone else added
      // deliberately.
      if (diff.missing.length > 0) {
        await this.webhooks.replaceEventTypes(existing.id, WEBHOOK_EVENT_TYPES);
        action = 'updated';
        detail = `Webhook updated: subscribed to ${diff.missing.length} missing event(s) — ${diff.missing.join(', ')}.`;
      }

      await this.repo.upsert(this.scope, {
        key,
        externalId: existing.id,
        fingerprint,
        metadata: { url, extraEvents: diff.extra },
      });
      return { key, action, externalId: existing.id, detail };
    }

    const created = await this.webhooks.create(url, WEBHOOK_EVENT_TYPES);
    await this.repo.upsert(this.scope, {
      key,
      externalId: created.id,
      fingerprint,
      metadata: { url },
    });

    return {
      key,
      action: 'created',
      externalId: created.id,
      detail: `Registered webhook for ${url} across ${WEBHOOK_EVENT_TYPES.length} event types (${created.id}).`,
    };
  }
}

/** A plan's configured price, for a drift message. */
function priceOf(plan: {
  billing_cycles?: {
    tenure_type?: string;
    pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } };
  }[];
}): string {
  const regular = plan.billing_cycles?.find((cycle) => cycle.tenure_type === 'REGULAR');
  const price = regular?.pricing_scheme?.fixed_price;
  return price ? `${price.value} ${price.currency_code}` : 'an unreadable amount';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
