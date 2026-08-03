import { PayPalFunding } from './paypal.funding';

/**
 * The parser is the whole safety property, so it is tested against the shapes
 * PayPal actually appends to its SDK bundle rather than against a fixture
 * invented here.
 *
 * The first case is the live rooferslabs account as of 2026-08-03: the wallet
 * is eligible but NOT vaultable, because Reference Transactions is not enabled.
 * Offering it would render a button whose approval always fails.
 */
describe('PayPalFunding.parse', () => {
  const LIVE_ACCOUNT =
    '__FUNDING_ELIGIBILITY__={"paypal":{"eligible":true,"vaultable":false},' +
    '"card":{"eligible":true,"branded":true,"vendors":{"visa":{"eligible":true,"vaultable":true},' +
    '"mastercard":{"eligible":true,"vaultable":true}}},"venmo":{"eligible":false,"vaultable":false}};';

  it('withholds a wallet that is eligible but not vaultable', () => {
    // The regression this class exists for: eligibility is not the question.
    expect(PayPalFunding.parse(LIVE_ACCOUNT)).toEqual(['card']);
  });

  it('offers the wallet once the account can vault it', () => {
    // Self-healing: enabling Reference Transactions must light the button up
    // with no deploy, so the only thing that changes here is PayPal's answer.
    const enabled = LIVE_ACCOUNT.replace(
      '"paypal":{"eligible":true,"vaultable":false}',
      '"paypal":{"eligible":true,"vaultable":true}',
    );
    expect(PayPalFunding.parse(enabled)).toEqual(['paypal', 'card']);
  });

  it('offers cards when any single brand vaults', () => {
    const oneBrand =
      '__FUNDING_ELIGIBILITY__={"paypal":{"eligible":true,"vaultable":false},' +
      '"card":{"vendors":{"visa":{"eligible":true,"vaultable":false},' +
      '"amex":{"eligible":true,"vaultable":true}}}};';
    expect(PayPalFunding.parse(oneBrand)).toEqual(['card']);
  });

  it('falls back to cards rather than offering nothing when the shape changes', () => {
    // A bundle this cannot read must not produce a page with no way to pay.
    // Cards are the safe default: every brand on this account vaults.
    expect(PayPalFunding.parse('some minified bundle with no eligibility block')).toEqual(['card']);
  });

  it('does not mistake one source’s vaultability for another’s', () => {
    // The regex is anchored per source name; a greedy match across the object
    // would read venmo's `true` as the wallet's.
    const crossed =
      '{"paypal":{"eligible":true,"vaultable":false},"venmo":{"eligible":true,"vaultable":true}}';
    expect(PayPalFunding.parse(crossed)).not.toContain('paypal');
  });
});
