import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ApiErrorCode, CompanyStatus, PlatformRole, UserRole } from '@rooferslabs/shared';
import {
  AllowNoCompany,
  AllowUnapprovedAccount,
  Public,
} from '../../common/decorators/public.decorator';
import { DomainException } from '../../common/exceptions/domain.exception';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import { AccountStatusService } from '../account-status.service';
import { AccountStatusGuard } from './account-status.guard';

const tenant: AuthenticatedUser = {
  id: 'user_1',
  clerkUserId: 'clerk_1',
  email: 'owner@a-roofing-company.com',
  firstName: null,
  lastName: null,
  role: UserRole.OWNER,
  platformRole: PlatformRole.NONE,
  companyId: 'company_1',
};

/**
 * A controller shaped like the ones this guard actually protects, so the
 * decorators are read from real metadata rather than from a hand-built stub.
 * Reflector behaviour — handler overriding class, absent metadata, the default
 * status list — is most of what the guard does, and a fake context would test
 * none of it.
 */
class GatedController {
  gated() {}

  @AllowUnapprovedAccount()
  wizard() {}

  @AllowUnapprovedAccount(CompanyStatus.PAUSED)
  servesPaused() {}

  @Public()
  webhook() {}

  @AllowNoCompany()
  session() {}
}

function contextFor(handler: keyof GatedController, user = tenant): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ authUser: user }) }),
    getHandler: () => GatedController.prototype[handler],
    getClass: () => GatedController,
  } as unknown as ExecutionContext;
}

/** A Prisma double that answers with whatever status the case is about. */
function guardFor(status: CompanyStatus | null) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue(status === null ? null : { status }),
    },
  } as unknown as PrismaService;
  return {
    guard: new AccountStatusGuard(new Reflector(), new AccountStatusService(prisma)),
    prisma,
  };
}

async function codeFrom(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'NO_ERROR';
  } catch (error) {
    return (error as DomainException).code;
  }
}

describe('AccountStatusGuard', () => {
  it('admits an approved tenant', async () => {
    const { guard } = guardFor(CompanyStatus.ACTIVE);
    await expect(guard.canActivate(contextFor('gated'))).resolves.toBe(true);
  });

  it('refuses a tenant awaiting approval with the code the client branches on', async () => {
    const { guard } = guardFor(CompanyStatus.PENDING_APPROVAL);
    await expect(codeFrom(guard.canActivate(contextFor('gated')))).resolves.toBe(
      ApiErrorCode.ACCOUNT_PENDING_APPROVAL,
    );
  });

  it('refuses a paused tenant with its own distinct code', async () => {
    // Distinct because the two mean different things to the person reading the
    // screen: one has never had access, the other has just lost it.
    const { guard } = guardFor(CompanyStatus.PAUSED);
    await expect(codeFrom(guard.canActivate(contextFor('gated')))).resolves.toBe(
      ApiErrorCode.ACCOUNT_PAUSED,
    );
  });

  it('refuses a tenant still in setup on a route that did not opt in', async () => {
    // This is the bypass the guard closes: before it, a tenant that stopped
    // mid-wizard had full API access to its own tenant without ever having been
    // approved, because nothing checked the status at all.
    const { guard } = guardFor(CompanyStatus.ONBOARDING);
    await expect(codeFrom(guard.canActivate(contextFor('gated')))).resolves.toBe(
      ApiErrorCode.ACCOUNT_PENDING_APPROVAL,
    );
  });

  it('admits a tenant in setup to a wizard route', async () => {
    const { guard } = guardFor(CompanyStatus.ONBOARDING);
    await expect(guard.canActivate(contextFor('wizard'))).resolves.toBe(true);
  });

  it('still refuses a paused tenant on a wizard route', async () => {
    // The exemption names ONBOARDING and only ONBOARDING. A boolean opt-out
    // would have handed the wizard to paused accounts as well, which is the
    // reason the decorator takes statuses.
    const { guard } = guardFor(CompanyStatus.PAUSED);
    await expect(codeFrom(guard.canActivate(contextFor('wizard')))).resolves.toBe(
      ApiErrorCode.ACCOUNT_PAUSED,
    );
  });

  it('honours a route that explicitly names the status it serves', async () => {
    const { guard } = guardFor(CompanyStatus.PAUSED);
    await expect(guard.canActivate(contextFor('servesPaused'))).resolves.toBe(true);
  });

  it('never queries the database for a public route', async () => {
    // Twilio's webhooks carry no principal at all; a lookup here would be a
    // round trip to answer a question nobody asked.
    const { guard, prisma } = guardFor(CompanyStatus.PAUSED);
    await expect(guard.canActivate(contextFor('webhook'))).resolves.toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  it('lets @AllowNoCompany routes through, so a waiting tenant can read its session', async () => {
    // `/auth/me` is how the browser learns it is pending and what the waiting
    // screen renders from. Gating it would leave the tenant on a blank page.
    const { guard, prisma } = guardFor(CompanyStatus.PENDING_APPROVAL);
    await expect(guard.canActivate(contextFor('session'))).resolves.toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  it('refuses when the principal names a company that no longer exists', async () => {
    const { guard } = guardFor(null);
    await expect(codeFrom(guard.canActivate(contextFor('gated')))).resolves.toBe(
      ApiErrorCode.COMPANY_NOT_FOUND,
    );
  });

  it('defers to TenantGuard for a principal with no company', async () => {
    const { guard, prisma } = guardFor(CompanyStatus.ACTIVE);
    const companyless = { ...tenant, companyId: null };
    await expect(guard.canActivate(contextFor('gated', companyless))).resolves.toBe(true);
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
  });

  it('reads the status from the database, never from the principal', async () => {
    // The whole security argument. A caller who forges anything the browser
    // sends still gets the status the database holds.
    const { guard, prisma } = guardFor(CompanyStatus.PAUSED);
    await expect(codeFrom(guard.canActivate(contextFor('gated')))).resolves.toBe(
      ApiErrorCode.ACCOUNT_PAUSED,
    );
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'company_1' },
      select: { status: true },
    });
  });
});
