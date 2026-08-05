import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PlatformRole, UserRole } from '@rooferslabs/shared';
import { ALLOW_NO_COMPANY_KEY } from '../common/constants';
import { ForbiddenError } from '../common/exceptions/domain.exception';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import type { ClerkService } from '../auth/clerk.service';
import { PlatformAdminService } from '../auth/platform-admin.service';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { AdminController } from './admin.controller';

/**
 * The admin portal is reached by people who belong to no company.
 *
 * `TenantGuard` and `SubscriptionGuard` are registered globally and therefore
 * run *before* any controller guard. Both demand a `companyId`, so without the
 * opt-out below every admin request died with "You must create or join a
 * company" long before authorisation was considered — which is exactly what
 * happened in production.
 *
 * These cases hold the two halves apart: staff are exempt from the *tenant*
 * checks, and are still subject to the *platform* one.
 */
const staff: AuthenticatedUser = {
  id: 'user_staff',
  clerkUserId: 'clerk_staff',
  email: 'founder@rooferslabs.com',
  firstName: null,
  lastName: null,
  role: UserRole.OWNER,
  platformRole: PlatformRole.OWNER,
  // The whole point: platform staff are not a tenant.
  companyId: null,
};

function contextFor(user: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ authUser: user }) }),
    getHandler: () => AdminController.prototype.overview,
    getClass: () => AdminController,
  } as unknown as ExecutionContext;
}

describe('AdminController tenancy', () => {
  const reflector = new Reflector();

  it('carries the platform guard at the class level, so every route inherits it', () => {
    // The protection is structural: a route added to this controller is guarded
    // because it is here. A per-route decorator would make it depend on someone
    // remembering, and the endpoint that got forgotten would be cross-tenant.
    const guards = Reflect.getMetadata('__guards__', AdminController) as unknown[] | undefined;
    expect(guards).toContain(PlatformAdminGuard);
  });

  it('declares @AllowNoCompany, so the global tenant guards let staff through', () => {
    const optOut = reflector.getAllAndOverride<boolean>(ALLOW_NO_COMPANY_KEY, [
      AdminController.prototype.overview,
      AdminController,
    ]);
    expect(optOut).toBe(true);
  });

  it('TenantGuard admits a companyless staff account on this controller', () => {
    expect(new TenantGuard(reflector).canActivate(contextFor(staff))).toBe(true);
  });

  it('TenantGuard still rejects a companyless account elsewhere', () => {
    // Same user, a controller with no opt-out: the tenant rule is intact.
    const elsewhere = {
      switchToHttp: () => ({ getRequest: () => ({ authUser: staff }) }),
      getHandler: () => () => undefined,
      getClass: () => class SomeTenantController {},
    } as unknown as ExecutionContext;

    expect(() => new TenantGuard(reflector).canActivate(elsewhere)).toThrow(ForbiddenError);
  });

  it('skipping the tenant check does not skip authorisation', async () => {
    const clerk = {
      getProfile: jest.fn().mockResolvedValue({ email: staff.email }),
    } as unknown as ClerkService;
    const guard = new PlatformAdminGuard(new PlatformAdminService(clerk));
    await expect(guard.canActivate(contextFor(staff))).resolves.toBe(true);

    // A customer — companyless or not — is still refused by the platform guard.
    const customer = { ...staff, email: 'owner@a-roofing-company.com', companyId: 'company_1' };
    await expect(guard.canActivate(contextFor(customer))).rejects.toThrow(ForbiddenError);
  });
});
