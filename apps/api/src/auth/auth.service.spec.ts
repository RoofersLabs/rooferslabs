import { PlatformRole, UserRole } from '@rooferslabs/shared';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import type { BillingService } from '../billing/services/billing.service';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { ClerkService } from './clerk.service';
import { PlatformAdminService } from './platform-admin.service';

/**
 * The session payload is what the browser decides the admin portal from, so the
 * platform role it carries has to be the same answer `PlatformAdminGuard` will
 * give the next request. A client told "you are staff" by a session and refused
 * by every call afterwards presents as a broken portal, not as a refusal.
 */
const staff: AuthenticatedUser = {
  id: 'user_staff',
  clerkUserId: 'clerk_staff',
  email: 'founder@rooferslabs.com',
  firstName: null,
  lastName: null,
  role: UserRole.MEMBER,
  platformRole: PlatformRole.OWNER,
  companyId: null,
};

const customer: AuthenticatedUser = {
  ...staff,
  id: 'user_customer',
  clerkUserId: 'clerk_customer',
  email: 'owner@a-roofing-company.com',
  role: UserRole.OWNER,
  platformRole: PlatformRole.NONE,
  companyId: null,
};

function serviceWith(clerkEmail: string | Error) {
  const getProfile = jest.fn(() =>
    clerkEmail instanceof Error
      ? Promise.reject(clerkEmail)
      : Promise.resolve({
          clerkUserId: 'clerk_staff',
          email: clerkEmail,
          firstName: null,
          lastName: null,
          avatarUrl: null,
        }),
  );
  const clerk = { getProfile } as unknown as ClerkService;
  const auth = new AuthService(
    clerk,
    {} as unknown as UsersService,
    {} as unknown as PrismaService,
    {} as unknown as BillingService,
    { payments: { enabled: false } } as unknown as AppConfigService,
    new PlatformAdminService(clerk),
  );
  return { auth, getProfile };
}

describe('AuthService.getSession — the platform role the client is told', () => {
  it('reports staff when Clerk still holds the allow-listed address', async () => {
    const { auth } = serviceWith('founder@rooferslabs.com');
    const session = await auth.getSession(staff);
    expect(session.user.platformRole).toBe(PlatformRole.OWNER);
  });

  it('downgrades to NONE when Clerk no longer agrees', async () => {
    // The local record is stale. The client must be told what the API will
    // enforce, not what our copy of the account says.
    const { auth } = serviceWith('someone-else@rooferslabs.com');
    const session = await auth.getSession(staff);
    expect(session.user.platformRole).toBe(PlatformRole.NONE);
  });

  it('downgrades to NONE when Clerk cannot be reached', async () => {
    const { auth } = serviceWith(new Error('clerk unavailable'));
    const session = await auth.getSession(staff);
    expect(session.user.platformRole).toBe(PlatformRole.NONE);
  });

  it('costs a customer no Clerk call at all', async () => {
    // Confirmation is only ever reached by an allow-listed address, so the
    // session every customer loads is unchanged and no slower.
    const { auth, getProfile } = serviceWith('founder@rooferslabs.com');
    const session = await auth.getSession(customer);
    expect(session.user.platformRole).toBe(PlatformRole.NONE);
    expect(getProfile).not.toHaveBeenCalled();
  });
});
