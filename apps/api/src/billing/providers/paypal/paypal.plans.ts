/**
 * The PayPal plan catalogue, as the request path sees it.
 *
 * A PayPal billing plan (`P-…`) is the unit a subscription is created against:
 * it carries the amount, the currency and the renewal cadence. Plans are created
 * once by `billing:paypal:setup` and their ids persisted in `billing_catalog`;
 * this class reads that table and answers the two questions a checkout and a
 * webhook ask — "which plan id do I charge?" and "which plan is this id?".
 *
 * Plan ids used to arrive as environment variables, which meant a launch
 * involved copying `P-…` strings from a dashboard into Terraform. Reading them
 * from the provisioned catalogue instead is what removes that step; nothing here
 * knows an identifier at compile time.
 *
 * ## Why there is a cache
 *
 * `planForPlanId` is called while normalizing every inbound webhook, on a path
 * that has no business awaiting a database round-trip per event. The catalogue
 * changes only when someone runs setup, so it is held in memory with a short
 * TTL — long enough to be free on the hot path, short enough that an API that
 * was running when setup was first executed picks the plans up without a
 * restart.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import { ExternalServiceError } from '../../../common/exceptions/domain.exception';
import { AppConfigService } from '../../../config/app-config.service';
import {
  BillingCatalogRepository,
  type CatalogScope,
} from '../../provisioning/billing-catalog.repository';
import { planCatalogKey, type PricingMode } from '../../provisioning/catalog.config';
import type { PlanSelection } from '../../types/billing.types';

/**
 * How long a loaded catalogue is trusted.
 *
 * Sixty seconds: a running API notices a freshly provisioned plan within a
 * minute, and a busy webhook burst costs one query rather than thousands.
 */
const CACHE_TTL_MS = 60_000;

interface CatalogEntry {
  planId: string;
  plan: SubscriptionPlan;
  interval: BillingInterval;
  mode: PricingMode;
}

@Injectable()
export class PayPalPlans implements OnModuleInit {
  private readonly logger = new Logger(PayPalPlans.name);

  /** planId → what it is. Rebuilt wholesale; never mutated in place. */
  private byPlanId = new Map<string, CatalogEntry>();
  /** catalogue key → plan id. */
  private byKey = new Map<string, string>();
  private loadedAt = 0;
  /** Collapses concurrent refreshes into one query. */
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: BillingCatalogRepository,
  ) {}

  private get scope(): CatalogScope {
    return {
      provider: PaymentProvider.PAYPAL,
      environment: this.config.paypal.environment,
    };
  }

  /**
   * Warm the cache at boot.
   *
   * Non-fatal on failure: a database that is briefly unreachable at start-up
   * should not stop the process from coming up, and the first lookup will try
   * again. Startup validation is what refuses to *serve* an unprovisioned
   * deployment — see BillingReadinessService.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.refresh();
      this.announceTestPricing();
    } catch (error) {
      this.logger.warn(
        `Could not load the billing catalogue at boot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Re-read the persisted catalogue. Called at boot, on expiry, and after a miss. */
  async refresh(): Promise<void> {
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  private async load(): Promise<void> {
    const entries = await this.repo.findAll(this.scope);

    const byPlanId = new Map<string, CatalogEntry>();
    const byKey = new Map<string, string>();

    for (const entry of entries) {
      // `plan:<PLAN>:<INTERVAL>` for the published price, with a `:test` suffix
      // for the token one. Anything else in the table (the product, the webhook)
      // is not a sellable plan and is skipped rather than parsed.
      const parts = entry.key.split(':');
      if (parts.length < 3 || parts.length > 4 || parts[0] !== 'plan') continue;

      const plan = parts[1] as SubscriptionPlan;
      const interval = parts[2] as BillingInterval;
      const mode: PricingMode = parts[3] === 'test' ? 'test' : 'production';
      if (!(plan in SubscriptionPlan) || !(interval in BillingInterval)) {
        this.logger.warn(`Ignoring billing_catalog row with unrecognized key "${entry.key}".`);
        continue;
      }

      byKey.set(entry.key, entry.externalId);
      // Both modes map back to the SAME domain plan. That is what keeps a
      // subscription bought at test pricing indistinguishable from a real one
      // everywhere above the adapter: same plan, same entitlement, same
      // lifecycle. Only the amount differed.
      byPlanId.set(entry.externalId, { planId: entry.externalId, plan, interval, mode });
    }

    this.byPlanId = byPlanId;
    this.byKey = byKey;
    this.loadedAt = Date.now();
  }

  private get isStale(): boolean {
    return Date.now() - this.loadedAt > CACHE_TTL_MS;
  }

  /**
   * Say out loud, once at boot, when this deployment charges something other
   * than what it advertises.
   *
   * Test pricing is invisible from the outside: the site still says $49, the
   * plan id in the database looks like any other, and nothing surfaces the
   * divergence until somebody reads a payout. So every process in this state
   * leaves a record in its boot log naming the variable to unset.
   *
   * `error` rather than `warn` when this is live money: a warning is something
   * to read later, and charging real cards a token amount is not.
   */
  private announceTestPricing(): void {
    const { testPricing, environment } = this.config.paypal;
    if (!testPricing) return;

    const message =
      `TEST PRICING ACTIVE — the Founding Customer monthly checkout is using the $1.00 test ` +
      `plan instead of the published $49.00 plan. The product still advertises $49 everywhere; ` +
      `subscriptions created now bill $1.00 and will KEEP billing $1.00 on renewal. Set ` +
      `PAYPAL_TEST_PRICING=false to restore normal pricing for new checkouts.`;

    if (environment === 'live') {
      this.logger.error(`${message} PAYPAL_ENVIRONMENT=live: these are real charges.`);
    } else {
      this.logger.warn(`${message} PAYPAL_ENVIRONMENT=sandbox: no money moves.`);
    }
  }

  /**
   * The plan id to charge for a selection.
   *
   * Refuses rather than guesses. An unprovisioned combination — annual, or
   * Professional — is not for sale, and the error says how to make it so.
   */
  async planIdFor(selection: PlanSelection): Promise<string> {
    if (this.isStale) await this.refresh();

    const mode = this.pricingModeFor(selection);
    const key = planCatalogKey(selection.plan, selection.interval, mode);
    let planId = this.byKey.get(key);

    // A miss on a warm cache is worth one more query: it is exactly what
    // happens on the first checkout after setup ran against a live API.
    if (!planId) {
      await this.refresh();
      planId = this.byKey.get(key);
    }

    if (!planId) {
      throw new ExternalServiceError(
        mode === 'test'
          ? `PAYPAL_TEST_PRICING is on but no test plan is provisioned for ${selection.plan} ` +
              `billed ${selection.interval.toLowerCase()}ly. Run \`npm run billing:paypal:setup\`, ` +
              `or set PAYPAL_TEST_PRICING=false to charge the published price.`
          : `No PayPal plan is provisioned for the ${selection.plan} plan billed ` +
              `${selection.interval.toLowerCase()}ly. Add it to CATALOG_PLANS and run ` +
              `\`npm run billing:paypal:setup\`.`,
      );
    }
    return planId;
  }

  /**
   * Which price a checkout should use.
   *
   * Test pricing applies only to the Founding Customer monthly plan — the one
   * thing actually on sale. Scoped this tightly on purpose: a flag that silently
   * discounted every plan would be a way to undercharge for everything, and the
   * blast radius of a forgotten environment variable should be one plan, not the
   * whole catalogue.
   */
  private pricingModeFor(selection: PlanSelection): PricingMode {
    if (!this.config.paypal.testPricing) return 'production';
    return selection.plan === SubscriptionPlan.STARTER &&
      selection.interval === BillingInterval.MONTH
      ? 'test'
      : 'production';
  }

  /**
   * Reverse lookup, so an inbound webhook can label a subscription.
   *
   * Synchronous by design: it runs while normalizing every event, and a miss is
   * survivable — the subscription syncs with a null plan and the next event,
   * after the cache has refreshed, labels it correctly.
   */
  planForPlanId(
    planId: string | null | undefined,
  ): { plan: SubscriptionPlan; interval: BillingInterval } | null {
    if (!planId) return null;

    // Resolves for BOTH modes, and deliberately reports the same domain plan
    // either way. A subscription bought at test pricing is a Founding Customer
    // subscription that happened to cost a dollar — it must grant the same
    // entitlement, and it must keep resolving after the flag is turned off, or
    // every existing test subscriber would silently lose their plan.
    const entry = this.byPlanId.get(planId);
    if (!entry) {
      if (this.isStale) void this.refresh();
      return null;
    }
    return { plan: entry.plan, interval: entry.interval };
  }
}
