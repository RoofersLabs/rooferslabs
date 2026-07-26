import { isPaymentsEnabled } from './payments.flag';

const env = (value?: string): NodeJS.ProcessEnv =>
  (value === undefined ? {} : { PAYMENTS_ENABLED: value }) as NodeJS.ProcessEnv;

describe('isPaymentsEnabled', () => {
  it('defaults to enabled when unset or blank', () => {
    // Fail closed: an absent or typo'd variable must never hand the product away
    // for free. Turning the wall off has to be deliberate.
    expect(isPaymentsEnabled(env())).toBe(true);
    expect(isPaymentsEnabled(env(''))).toBe(true);
    expect(isPaymentsEnabled(env('   '))).toBe(true);
  });

  it.each(['false', 'FALSE', 'False', ' false ', '0', 'no', 'off'])(
    'disables payments for %p',
    (value) => {
      expect(isPaymentsEnabled(env(value))).toBe(false);
    },
  );

  it.each(['true', 'TRUE', '1', 'yes', 'on'])('keeps payments enabled for %p', (value) => {
    expect(isPaymentsEnabled(env(value))).toBe(true);
  });

  it('treats an unrecognised value as enabled', () => {
    expect(isPaymentsEnabled(env('maybe'))).toBe(true);
  });
});
