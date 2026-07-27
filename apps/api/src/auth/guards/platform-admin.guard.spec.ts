import type { ExecutionContext } from '@nestjs/common';
import { PlatformRole, UserRole } from '@rooferslabs/shared';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * The admin portal reads every tenant's data. This guard is the only thing
 * standing between that and the customer base, so the cases below are the
 * security boundary written down.
 *
 * The one that matters most: a customer holds `UserRole.OWNER` — it is the
 * default assigned at signup — and must still be refused.
 */
function contextFor(user: Partial<AuthenticatedUser> | undefined): ExecutionContext {
  const request = user ? { authUser: user } : {};
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const customer: Partial<AuthenticatedUser> = {
  id: 'user_customer',
  role: UserRole.OWNER,
  platformRole: PlatformRole.NONE,
  companyId: 'company_1',
};

const staff: Partial<AuthenticatedUser> = {
  id: 'user_staff',
  role: UserRole.MEMBER,
  platformRole: PlatformRole.OWNER,
  companyId: null,
};

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  it('admits a user holding the platform owner role', () => {
    expect(guard.canActivate(contextFor(staff))).toBe(true);
  });

  it('refuses a company owner — the role every customer has', () => {
    // The defect this guard exists to prevent: gating on `role === OWNER` would
    // have admitted the entire customer base.
    expect(() => guard.canActivate(contextFor(customer))).toThrow(ForbiddenError);
  });

  it.each([
    ['company admin', UserRole.ADMIN],
    ['company member', UserRole.MEMBER],
  ])('refuses a %s with no platform role', (_label, role) => {
    expect(() => guard.canActivate(contextFor({ ...customer, role }))).toThrow(ForbiddenError);
  });

  it('refuses a user whose platformRole is explicitly NONE', () => {
    expect(() =>
      guard.canActivate(contextFor({ ...staff, platformRole: PlatformRole.NONE })),
    ).toThrow(ForbiddenError);
  });

  it('refuses when platformRole is missing entirely', () => {
    // An older token, or a record predating the column: absence must not pass.
    const withoutRole: Partial<AuthenticatedUser> = { ...staff };
    delete withoutRole.platformRole;
    expect(() => guard.canActivate(contextFor(withoutRole))).toThrow(ForbiddenError);
  });

  it('refuses an unauthenticated request', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenError);
  });

  it('does not reveal that an admin surface exists', () => {
    // The message is the same one any forbidden resource returns.
    expect(() => guard.canActivate(contextFor(customer))).toThrow(
      'You do not have access to this resource.',
    );
  });
});
