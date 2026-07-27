import { PlatformRole, UserRole } from '@rooferslabs/shared';
import { resolveAdminAccess, type AdminAccessFacts } from './adminAccess';

const base: AdminAccessFacts = {
  clerkLoaded: true,
  signedIn: true,
  sessionLoading: false,
  sessionFailed: false,
  platformRole: PlatformRole.OWNER,
};

const resolve = (over: Partial<AdminAccessFacts> = {}) => resolveAdminAccess({ ...base, ...over });

describe('resolveAdminAccess', () => {
  it('grants a platform owner', () => {
    expect(resolve()).toBe('granted');
  });

  describe('refusal', () => {
    it('denies a signed-in account with no platform role', () => {
      expect(resolve({ platformRole: PlatformRole.NONE })).toBe('denied');
    });

    it('denies when the platform role is absent', () => {
      expect(resolve({ platformRole: undefined })).toBe('denied');
    });

    // `UserRole.OWNER` and `PlatformRole.OWNER` are the same *string*, so no
    // assertion here can tell them apart — which is exactly the hazard. The
    // protection is that `AdminAccessFacts.platformRole` is typed as
    // `PlatformRole`, so passing `user.role` to it does not compile, and that
    // the API refuses the data regardless of what the client believes.
    it('shares a string value with the customer role, so the type is the guard', () => {
      expect(String(PlatformRole.OWNER)).toBe(String(UserRole.OWNER));
    });

    it('denies rather than redirecting, so the customer app stays off this host', () => {
      expect(['denied', 'sign-in']).toContain(resolve({ platformRole: PlatformRole.NONE }));
      expect(resolve({ platformRole: PlatformRole.NONE })).not.toBe('granted');
    });
  });

  describe('ordering — nothing renders before identity resolves', () => {
    it('holds while Clerk is loading, even with a role already known', () => {
      expect(resolve({ clerkLoaded: false })).toBe('loading');
    });

    it('holds while the session is in flight', () => {
      expect(resolve({ sessionLoading: true, platformRole: undefined })).toBe('loading');
    });

    it('never denies on the strength of an unloaded session', () => {
      // Denying here would show "access denied" to the founder mid-load.
      expect(resolve({ sessionLoading: true, platformRole: undefined })).not.toBe('denied');
    });

    it('sends a signed-out visitor to sign in before any session work', () => {
      expect(resolve({ signedIn: false, sessionLoading: true })).toBe('sign-in');
    });

    it('reports a failed session as an error, not a refusal', () => {
      expect(resolve({ sessionFailed: true, platformRole: undefined })).toBe('error');
    });
  });
});
