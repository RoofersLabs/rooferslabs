/**
 * Can this deployment actually take money?
 *
 * One answer, used in three places: the boot sequence (which refuses to serve a
 * deployed environment that would fail every checkout), the readiness probe, and
 * the setup command's closing validation. Having a single implementation is the
 * point — three separate notions of "configured" would eventually disagree, and
 * the one that mattered would be the one nobody ran.
 *
 * Every check is a *local* read except the credential check, which is a single
 * token mint. Readiness must not become an outbound fan-out to PayPal on every
 * probe, so the expensive checks are opt-in.
 */
import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@rooferslabs/shared';
import { AppConfigService } from '../../config/app-config.service';
import { PayPalClient } from '../providers/paypal/paypal.client';
import { BillingCatalogRepository, type CatalogScope } from './billing-catalog.repository';
import {
  CATALOG_PLANS,
  PRODUCT_CATALOG_KEY,
  WEBHOOK_CATALOG_KEY,
  planCatalogKey,
  type PricingMode,
} from './catalog.config';

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  /** What to do about it. Empty when the check passed. */
  remedy?: string;
}

export interface BillingReadiness {
  /** True when this deployment can complete a checkout end to end. */
  ready: boolean;
  /** False when billing is switched off platform-wide; nothing else applies. */
  enabled: boolean;
  provider: PaymentProvider;
  environment: string;
  /**
   * True when checkouts charge the token test price rather than the published
   * one. Reported everywhere readiness is, because a deployment quietly billing
   * $1 instead of $49 should never be something you have to go looking for.
   */
  testPricing: boolean;
  checks: ReadinessCheck[];
}

@Injectable()
export class BillingReadinessService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: BillingCatalogRepository,
    private readonly client: PayPalClient,
  ) {}

  private get scope(): CatalogScope {
    return {
      provider: PaymentProvider.PAYPAL,
      environment: this.config.paypal.environment,
    };
  }

  /**
   * Assess billing readiness.
   *
   * `verifyCredentials` mints a token against PayPal, so it is off by default:
   * the readiness probe runs on every ALB health check and must stay local. The
   * boot sequence and the setup command turn it on, because both are once-per-
   * deployment and both would rather find out now than on a customer's checkout.
   */
  async check(options: { verifyCredentials?: boolean } = {}): Promise<BillingReadiness> {
    const enabled = this.config.payments.enabled;
    const provider = this.config.payments.provider;
    const environment = this.config.paypal.environment;

    // With the wall down there is nothing to be ready for: no provider client is
    // constructed, no webhook route is mounted, and every tenant reaches the
    // product. Reporting "not ready" would be misleading, not useful.
    if (!enabled) {
      return {
        ready: true,
        enabled: false,
        provider,
        environment,
        testPricing: false,
        checks: [],
      };
    }

    // Stripe brings its own configuration story and its own env validation;
    // this service speaks for PayPal only.
    if (provider !== PaymentProvider.PAYPAL) {
      return {
        ready: true,
        enabled: true,
        provider,
        environment,
        testPricing: false,
        checks: [],
      };
    }

    const checks: ReadinessCheck[] = [];

    checks.push({
      name: 'credentials-present',
      ok: this.client.isConfigured,
      remedy: this.client.isConfigured
        ? undefined
        : 'Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
    });

    if (options.verifyCredentials && this.client.isConfigured) {
      const access = await this.client.verifyAccess();
      checks.push({
        name: 'credentials-valid',
        ok: access.ok,
        remedy: access.ok
          ? undefined
          : access.stage === 'auth'
            ? `PayPal rejected the credentials (${access.detail}). Confirm they belong to the ${environment} estate.`
            : `PayPal authenticated but refused a catalogue read (${access.detail}). Enable the Subscriptions capability on the REST app.`,
      });
    }

    const entries = await this.repo.findAll(this.scope);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));

    checks.push({
      name: 'product-provisioned',
      ok: byKey.has(PRODUCT_CATALOG_KEY),
      remedy: byKey.has(PRODUCT_CATALOG_KEY)
        ? undefined
        : 'Run `npm run billing:paypal:setup` to create the product.',
    });

    // The plans this deployment would actually charge — the ones matching the
    // active pricing mode. A deployment with a product and no plan passes every
    // credential check and still fails the first checkout.
    //
    // Scoped to the active mode rather than the whole catalogue on purpose. The
    // inactive mode's plan is provisioned too, but its absence cannot break a
    // checkout, and failing a boot over a plan nothing will charge would make an
    // environment provisioned before test pricing existed refuse to start.
    const activeMode: PricingMode = this.config.paypal.testPricing ? 'test' : 'production';
    for (const plan of CATALOG_PLANS.filter((entry) => entry.pricingMode === activeMode)) {
      const key = planCatalogKey(plan.plan, plan.interval, plan.pricingMode);
      checks.push({
        name: `plan-provisioned:${key}`,
        ok: byKey.has(key),
        remedy: byKey.has(key)
          ? undefined
          : `Plan "${plan.name}" is not provisioned. Run \`npm run billing:paypal:setup\`.`,
      });
    }

    checks.push({
      name: 'webhook-registered',
      ok: byKey.has(WEBHOOK_CATALOG_KEY),
      remedy: byKey.has(WEBHOOK_CATALOG_KEY)
        ? undefined
        : 'No webhook is registered, so subscriptions would never activate. Run `npm run billing:paypal:setup` ' +
          'from an environment whose API_PUBLIC_URL is a public HTTPS origin.',
    });

    return {
      ready: checks.every((check) => check.ok),
      enabled: true,
      provider,
      environment,
      testPricing: this.config.paypal.testPricing,
      checks,
    };
  }

  /**
   * The webhook id signature verification should use.
   *
   * The explicit environment variable wins so a hand-registered webhook is
   * always honoured; otherwise the provisioned one. Returns null when neither
   * exists, which is what makes every inbound delivery fail closed rather than
   * be accepted unverified.
   */
  async resolveWebhookId(): Promise<string | null> {
    if (this.config.paypal.webhookId) return this.config.paypal.webhookId;
    const entry = await this.repo.find(this.scope, WEBHOOK_CATALOG_KEY);
    return entry?.externalId ?? null;
  }

  /** A readable multi-line diagnosis, for a boot log or an operator's terminal. */
  static format(readiness: BillingReadiness): string {
    if (!readiness.enabled) {
      return 'Billing is disabled (PAYMENTS_ENABLED=false): no payment wall, every tenant has full access.';
    }

    const lines = [
      `Billing readiness — ${readiness.provider.toLowerCase()} (${readiness.environment}): ` +
        (readiness.ready ? 'READY' : 'NOT READY'),
    ];
    if (readiness.testPricing) {
      lines.push('  ⚠ TEST PRICING IS ON — checkouts charge $1.00, not the published $49.00.');
    }
    for (const check of readiness.checks) {
      lines.push(
        `  ${check.ok ? '✓' : '✗'} ${check.name}${check.remedy ? ` — ${check.remedy}` : ''}`,
      );
    }
    return lines.join('\n');
  }
}
