import type { ExecutionContext } from '@nestjs/common';
import { PlatformRole, UserRole, isPlatformAdminEmail } from '@rooferslabs/shared';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import type { ClerkService } from '../clerk.service';
import { PlatformAdminService } from '../platform-admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * The admin portal reads every tenant's data. This guard is the only thing
 * standing between that and the customer base, so the cases below are the
 * security boundary written down.
 *
 * Two of them matter more than the rest:
 *
 *  - a customer holds `UserRole.OWNER` — it is the default assigned at signup —
 *    and must still be refused;
 *  - a `platformRole` of `OWNER` on the principal is *not* a grant. The column
 *    it used to come from is no longer the authority, so a row that still says
 *    OWNER must open nothing.
 */

const FOUNDER = 'founder@rooferslabs.com';

function contextFor(user: Partial<AuthenticatedUser> | undefined): ExecutionContext {
  const request = user ? { authUser: user } : {};
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const customer: Partial<AuthenticatedUser> = {
  id: 'user_customer',
  clerkUserId: 'clerk_customer',
  email: 'owner@a-roofing-company.com',
  role: UserRole.OWNER,
  platformRole: PlatformRole.NONE,
  companyId: 'company_1',
};

const staff: Partial<AuthenticatedUser> = {
  id: 'user_staff',
  clerkUserId: 'clerk_staff',
  email: FOUNDER,
  role: UserRole.MEMBER,
  platformRole: PlatformRole.OWNER,
  companyId: null,
};

/** Clerk agreeing with the local record, which is the ordinary case. */
function clerkReturning(email: string) {
  const getProfile = jest.fn().mockResolvedValue({
    clerkUserId: 'clerk_staff',
    email,
    firstName: null,
    lastName: null,
    avatarUrl: null,
  });
  return { service: { getProfile } as unknown as ClerkService, getProfile };
}

describe('isPlatformAdminEmail', () => {
  it('admits the founder address', () => {
    expect(isPlatformAdminEmail(FOUNDER)).toBe(true);
  });

  it.each([
    ['upper case', 'FOUNDER@ROOFERSLABS.COM'],
    ['mixed case', 'Founder@RoofersLabs.com'],
    ['surrounding whitespace', '  founder@rooferslabs.com  '],
  ])('admits the founder address with %s', (_label, email) => {
    expect(isPlatformAdminEmail(email)).toBe(true);
  });

  it.each([
    ['a subdomain lookalike', 'founder@rooferslabs.com.attacker.test'],
    ['a prefixed local part', 'xfounder@rooferslabs.com'],
    ['a suffixed local part', 'founderx@rooferslabs.com'],
    ['a plus-addressed variant', 'founder+admin@rooferslabs.com'],
    ['a different TLD', 'founder@rooferslabs.co'],
    ['a lookalike domain', 'founder@roofers-labs.com'],
    ['another address on the domain', 'support@rooferslabs.com'],
    ['a customer', 'owner@a-roofing-company.com'],
  ])('refuses %s', (_label, email) => {
    expect(isPlatformAdminEmail(email)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('refuses %s rather than throwing', (_label, email) => {
    expect(isPlatformAdminEmail(email)).toBe(false);
  });
});

/** The guard and the service it delegates to, assembled as Nest assembles them. */
function guardWith(clerk: ClerkService): PlatformAdminGuard {
  return new PlatformAdminGuard(new PlatformAdminService(clerk));
}

describe('PlatformAdminGuard', () => {
  it('admits the founder when Clerk still reports that address', async () => {
    const { service, getProfile } = clerkReturning(FOUNDER);
    await expect(guardWith(service).canActivate(contextFor(staff))).resolves.toBe(true);
    expect(getProfile).toHaveBeenCalledWith('clerk_staff');
  });

  it('admits the founder when Clerk reports the address in a different case', async () => {
    const { service } = clerkReturning('Founder@RoofersLabs.com');
    await expect(guardWith(service).canActivate(contextFor(staff))).resolves.toBe(true);
  });

  it('refuses a company owner — the role every customer has', async () => {
    // The defect this guard exists to prevent: gating on `role === OWNER` would
    // have admitted the entire customer base.
    const { service } = clerkReturning(FOUNDER);
    await expect(guardWith(service).canActivate(contextFor(customer))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it.each([
    ['company admin', UserRole.ADMIN],
    ['company member', UserRole.MEMBER],
  ])('refuses a %s', async (_label, role) => {
    const { service } = clerkReturning(FOUNDER);
    await expect(guardWith(service).canActivate(contextFor({ ...customer, role }))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('refuses a principal carrying platformRole OWNER but another address', async () => {
    // The database column is no longer the authority. A row left over from the
    // old model — or written by anything that can reach the database — grants
    // nothing on its own.
    const { service, getProfile } = clerkReturning(FOUNDER);
    const impostor = { ...customer, platformRole: PlatformRole.OWNER };

    await expect(guardWith(service).canActivate(contextFor(impostor))).rejects.toThrow(
      ForbiddenError,
    );
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('refuses when the local record is allow-listed but Clerk disagrees', async () => {
    // The address moved in Clerk after provisioning: our copy is stale, and the
    // identity provider wins.
    const { service } = clerkReturning('someone-else@rooferslabs.com');
    await expect(guardWith(service).canActivate(contextFor(staff))).rejects.toThrow(ForbiddenError);
  });

  it('refuses when Clerk cannot be reached', async () => {
    // Fail closed: an identity-provider outage takes the portal down rather
    // than opening it.
    const getProfile = jest.fn().mockRejectedValue(new Error('clerk unavailable'));
    const service = { getProfile } as unknown as ClerkService;
    await expect(guardWith(service).canActivate(contextFor(staff))).rejects.toThrow(ForbiddenError);
  });

  it('refuses an unauthenticated request without calling Clerk', async () => {
    const { service, getProfile } = clerkReturning(FOUNDER);
    await expect(guardWith(service).canActivate(contextFor(undefined))).rejects.toThrow(
      ForbiddenError,
    );
    expect(getProfile).not.toHaveBeenCalled();
  });

  it('refuses a principal with no email', async () => {
    const { service } = clerkReturning(FOUNDER);
    const withoutEmail: Partial<AuthenticatedUser> = { ...staff };
    delete withoutEmail.email;
    await expect(guardWith(service).canActivate(contextFor(withoutEmail))).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('confirms with Clerk once per account rather than once per request', async () => {
    // The portal issues several requests per page and is used by one person.
    const { service, getProfile } = clerkReturning(FOUNDER);
    const guard = guardWith(service);

    await guard.canActivate(contextFor(staff));
    await guard.canActivate(contextFor(staff));
    await guard.canActivate(contextFor(staff));

    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('asks Clerk again once the confirmation has expired', async () => {
    const { service, getProfile } = clerkReturning(FOUNDER);
    const guard = guardWith(service);

    await guard.canActivate(contextFor(staff));
    const later = Date.now() + 61_000;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    await guard.canActivate(contextFor(staff));
    jest.spyOn(Date, 'now').mockRestore();

    expect(getProfile).toHaveBeenCalledTimes(2);
  });

  it('does not reveal that an admin surface exists', async () => {
    // The message is the same one any forbidden resource returns.
    const { service } = clerkReturning(FOUNDER);
    await expect(guardWith(service).canActivate(contextFor(customer))).rejects.toThrow(
      'You do not have access to this resource.',
    );
  });
});
