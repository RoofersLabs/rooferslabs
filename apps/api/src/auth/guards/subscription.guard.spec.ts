import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { ApiErrorCode } from '@rooferslabs/shared';
import { DomainException } from '../../common/exceptions/domain.exception';
import type { BillingService } from '../../billing/services/billing.service';
import { SubscriptionGuard } from './subscription.guard';

const COMPANY = 'company_1';

function makeContext(companyId: string | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ authUser: companyId ? { id: 'u1', companyId } : { id: 'u1' } }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(options: { exempt?: boolean; active?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.exempt ?? false),
  } as unknown as Reflector;
  const billing = {
    hasActiveSubscription: jest.fn().mockResolvedValue(options.active ?? false),
  } as unknown as jest.Mocked<BillingService>;
  return { guard: new SubscriptionGuard(reflector, billing), billing };
}

describe('SubscriptionGuard', () => {
  it('blocks a tenant without an active subscription with 402 SUBSCRIPTION_REQUIRED', async () => {
    const { guard } = makeGuard({ active: false });
    await expect(guard.canActivate(makeContext(COMPANY))).rejects.toMatchObject({
      code: ApiErrorCode.SUBSCRIPTION_REQUIRED,
      status: 402,
    });
    await expect(guard.canActivate(makeContext(COMPANY))).rejects.toBeInstanceOf(DomainException);
  });

  it('allows a tenant with an active subscription', async () => {
    const { guard } = makeGuard({ active: true });
    await expect(guard.canActivate(makeContext(COMPANY))).resolves.toBe(true);
  });

  it('lets exempt routes through without consulting billing', async () => {
    const { guard, billing } = makeGuard({ exempt: true, active: false });
    await expect(guard.canActivate(makeContext(COMPANY))).resolves.toBe(true);
    expect(billing.hasActiveSubscription).not.toHaveBeenCalled();
  });

  it('defers to the tenant guard when the user has no company yet', async () => {
    const { guard, billing } = makeGuard({ active: false });
    await expect(guard.canActivate(makeContext(null))).resolves.toBe(true);
    expect(billing.hasActiveSubscription).not.toHaveBeenCalled();
  });
});
