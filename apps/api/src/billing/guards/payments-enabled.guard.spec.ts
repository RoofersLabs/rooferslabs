import { ApiErrorCode } from '@rooferslabs/shared';
import type { AppConfigService } from '../../config/app-config.service';
import { PaymentsEnabledGuard } from './payments-enabled.guard';

const guardWith = (enabled: boolean) =>
  new PaymentsEnabledGuard({ payments: { enabled } } as unknown as AppConfigService);

describe('PaymentsEnabledGuard', () => {
  it('lets billing through when payments are enabled', () => {
    expect(guardWith(true).canActivate()).toBe(true);
  });

  it('answers 503 PAYMENTS_DISABLED when payments are disabled', () => {
    // 503, not 402: nothing the caller can do satisfies this, and unlike
    // SUBSCRIPTION_REQUIRED it must not be read as "go and pay".
    expect(() => guardWith(false).canActivate()).toThrow(
      expect.objectContaining({ code: ApiErrorCode.PAYMENTS_DISABLED, status: 503 }),
    );
  });
});
