import type { User } from '@prisma/client';
import { PlatformRole, UserRole } from '@rooferslabs/shared';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';

/**
 * `toAuthenticatedUser` is where the platform decides, once per request, whether
 * the person holding this session is staff. Everything downstream — the session
 * payload, the client's admin gate — repeats that answer rather than working it
 * out again, so these are the cases that decide what an admin portal shows.
 *
 * The row's own `platformRole` is set to the *opposite* of the expected answer
 * in both directions below. That is the point: the column is a leftover, and a
 * value left in it must not change anything.
 */
function userRow(over: Partial<User> = {}): User {
  return {
    id: 'user_1',
    clerkUserId: 'clerk_1',
    email: 'owner@a-roofing-company.com',
    firstName: null,
    lastName: null,
    role: UserRole.OWNER,
    platformRole: PlatformRole.NONE,
    companyId: 'company_1',
    ...over,
  } as unknown as User;
}

describe('UsersService.toAuthenticatedUser', () => {
  const service = new UsersService({} as unknown as UsersRepository);

  it('derives platform ownership from an allow-listed email', () => {
    const principal = service.toAuthenticatedUser(
      userRow({ email: 'founder@rooferslabs.com', platformRole: PlatformRole.NONE }),
    );
    expect(principal.platformRole).toBe(PlatformRole.OWNER);
  });

  it('ignores a stray OWNER left in the column', () => {
    // The old model granted access by writing this value. It must now grant
    // nothing at all — including to a row restored from an old snapshot.
    const principal = service.toAuthenticatedUser(
      userRow({ email: 'owner@a-roofing-company.com', platformRole: PlatformRole.OWNER }),
    );
    expect(principal.platformRole).toBe(PlatformRole.NONE);
  });

  it('matches the allow-list without regard to case', () => {
    const principal = service.toAuthenticatedUser(userRow({ email: 'Founder@RoofersLabs.com' }));
    expect(principal.platformRole).toBe(PlatformRole.OWNER);
  });

  it('leaves the company role alone', () => {
    // The two authorities are separate: being staff is not being a tenant's
    // owner, and this mapping must not blur them.
    const principal = service.toAuthenticatedUser(
      userRow({ email: 'founder@rooferslabs.com', role: UserRole.MEMBER }),
    );
    expect(principal.role).toBe(UserRole.MEMBER);
    expect(principal.platformRole).toBe(PlatformRole.OWNER);
  });
});
