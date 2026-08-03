/**
 * Which funding sources this merchant account can actually bill a subscription
 * through.
 *
 * A subscription is a billing agreement, so the funding source has to be
 * *vaultable* — storable for future charges. Eligibility and vaultability are
 * different answers and PayPal returns both: a source can be eligible (the
 * button is allowed to render) while not being vaultable (a subscription
 * against it can never be approved).
 *
 * That gap is not hypothetical here. The live account behind rooferslabs
 * reports `paypal: {eligible: true, vaultable: false}` while every card brand
 * vaults, because Reference Transactions is not enabled on it. Rendering the
 * wallet button on `eligible` alone produces a checkout that reaches PayPal's
 * own approval page and dies there with "The merchant isn't able to accept
 * PayPal payments at this time" — no API call fails, so nothing in our logs
 * explains it. The JS SDK's `isEligible()` keys off `eligible`, which is why
 * this decision cannot be left to the browser.
 *
 * There is no REST endpoint for this. The eligibility map is computed per
 * client id and appended to the JS SDK bundle, so the bundle is the source —
 * fetched here exactly as a browser would, and parsed for the two booleans that
 * matter.
 *
 * Deliberately self-healing: the moment PayPal enables Reference Transactions
 * on the account, the wallet reports vaultable and the button appears without a
 * deploy.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';

/** A funding source the browser may render a button for. */
export type FundingSource = 'paypal' | 'card';

/** How long a probe result is trusted. An account capability changes rarely. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * What to offer when the probe cannot answer.
 *
 * Cards, not the wallet. Every card brand on this account vaults, and a payer
 * shown one working button completes a subscription; a payer shown a broken one
 * does not. Degrading toward the source that works is the safe direction.
 */
const FALLBACK: FundingSource[] = ['card'];

@Injectable()
export class PayPalFunding {
  private readonly logger = new Logger(PayPalFunding.name);

  private cached: { at: number; sources: FundingSource[] } | null = null;
  /** In-flight probe, so a burst of config reads makes one request. */
  private inFlight: Promise<FundingSource[]> | null = null;

  constructor(private readonly config: AppConfigService) {}

  /** The funding sources the browser should render, cached per process. */
  async sources(): Promise<FundingSource[]> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.sources;
    }
    this.inFlight ??= this.probe().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async probe(): Promise<FundingSource[]> {
    const clientId = this.config.paypal.clientId;
    if (!clientId) return FALLBACK;

    try {
      const url =
        `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
        `&vault=true&intent=subscription&components=buttons`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`PayPal SDK responded ${response.status}`);

      const sources = PayPalFunding.parse(await response.text());
      this.cached = { at: Date.now(), sources };

      if (!sources.includes('paypal')) {
        // Load-bearing operationally: it is the difference between "PayPal is
        // broken" and "this account cannot vault the wallet yet".
        this.logger.warn(
          'The PayPal wallet is not vaultable on this merchant account, so it cannot back a ' +
            'subscription and its button is withheld. Cards are unaffected. Ask PayPal to enable ' +
            'Reference Transactions to offer it.',
        );
      }
      return sources;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not read PayPal funding eligibility (${message}); offering cards.`);
      return FALLBACK;
    }
  }

  /**
   * Pull the vaultable funding sources out of an SDK bundle.
   *
   * Matched with a narrow regex rather than by parsing the appended object:
   * it is minified JavaScript, not JSON, and only two keys are needed. A shape
   * change makes a source read as unavailable, which degrades to cards rather
   * than to a broken button.
   */
  static parse(bundle: string): FundingSource[] {
    const vaultable = (name: string): boolean => {
      const match = new RegExp(`"${name}":\\{[^}]*?"vaultable":(true|false)`).exec(bundle);
      return match?.[1] === 'true';
    };

    const sources: FundingSource[] = [];
    if (vaultable('paypal')) sources.push('paypal');
    // The card entry nests its brands, so vaultability is read from a vendor.
    // Any vaulting brand means the card button can carry a subscription.
    if (['visa', 'mastercard', 'amex', 'discover'].some(vaultable)) sources.push('card');

    return sources.length > 0 ? sources : FALLBACK;
  }
}
