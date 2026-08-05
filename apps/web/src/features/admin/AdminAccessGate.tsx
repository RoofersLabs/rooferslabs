import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useAccess } from '@/auth/AccessProvider';
import { LogoMark } from '@/components/Brand';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { ROUTES } from '@/auth/stages';
import { ADMIN_ROUTES } from './routes';
import { resolveAdminAccess } from './adminAccess';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

/**
 * A branded hold while identity resolves.
 *
 * Shown instead of any page at all, because the alternative is rendering the
 * wrong one: the portal's whole point is that a customer surface never appears
 * on this hostname, not even for a frame.
 */
function AdminLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base px-4">
      <LogoMark className="h-5 text-brand-950" />
      <div className="flex items-center gap-2.5 text-ink-muted">
        <Spinner className="h-4 w-4" />
        <p className="text-small">{label}</p>
      </div>
    </div>
  );
}

/**
 * Signed in, but not staff.
 *
 * Deliberately a terminus rather than a redirect. Bouncing a customer into
 * their own dashboard would imply they took a wrong turn; they did not — they
 * reached a real address and were refused. It also keeps the customer app off
 * this hostname, which is the rule the whole surface is built on.
 */
function AdminAccessDenied({ email }: { email: string | null }) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <Card className="max-w-md items-center px-8 py-10 text-center">
        <IconTile icon={ShieldExclamationIcon} tone="emergency" size="xl" />
        <h1 className="mt-5 text-h4 text-ink">Access denied</h1>
        <p className="mt-2 max-w-sm text-body leading-6 text-ink-muted">
          {email ? <span className="font-medium text-ink">{email}</span> : 'This account'} is not
          authorized to use the rooferslabs Admin Portal. It is restricted to rooferslabs staff.
        </p>
        <p className="mt-3 max-w-sm text-small text-ink-faint">
          If you are a rooferslabs customer, your dashboard is at{' '}
          <a
            className="focus-ring rounded-focus text-accent transition-colors duration-fast hover:text-accent-hover"
            href="https://rooferslabs.com/dashboard"
          >
            rooferslabs.com
          </a>
          .
        </p>
        <Button className="mt-6" variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}

/**
 * The portal's front door: authenticate, then authorise, then render.
 *
 * This is a *user-experience* gate. It decides what a browser is shown, never
 * what data it may have — `PlatformAdminGuard` on the API answers that on every
 * single request, and would refuse a caller who defeated everything here.
 *
 * It reads `platformRole`, never `role`. Every customer is a `UserRole.OWNER`,
 * so that field could never distinguish staff from the customer base. The value
 * arrives already decided: the API derives it from the account's email against
 * the staff allow-list, so this file holds no copy of the rule to fall out of
 * step with.
 *
 * Ordering matters: nothing renders until both Clerk and the session have
 * resolved, so the portal never flashes a wrong state on the way to the right
 * one.
 */
export function AdminAccessGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const access = useAccess();
  const location = useLocation();

  // `platformRole`, never `role`: the two enums share the string 'OWNER', and
  // `role` is what every customer is given at signup. The parameter's type is
  // what makes passing the wrong one a compile error.
  const state = resolveAdminAccess({
    clerkLoaded: isLoaded,
    signedIn: Boolean(isSignedIn),
    sessionLoading: access.isLoading,
    sessionFailed: Boolean(access.error),
    platformRole: access.user?.platformRole,
  });

  switch (state) {
    case 'loading':
      return <AdminLoading label={isLoaded ? 'Checking your access…' : 'Signing you in…'} />;

    case 'sign-in':
      // Carry the destination so sign-in returns here rather than to a default,
      // and so a deep link into the portal survives the round trip.
      return <Navigate to={ROUTES.signIn} replace state={{ from: location.pathname }} />;

    case 'error':
      // A failed session request is not a refusal — saying "access denied"
      // here would blame the operator for an outage.
      return (
        <div className="flex min-h-screen items-center justify-center bg-base p-6">
          <Card className="max-w-md px-8 py-10">
            <ErrorState
              title="Couldn’t verify your access"
              message={access.error?.message ?? 'Please try again.'}
              onRetry={access.retry}
            />
          </Card>
        </div>
      );

    case 'denied':
      return <AdminAccessDenied email={access.user?.email ?? null} />;

    case 'granted':
      return <Outlet />;
  }
}

/** Anything unrecognised on this hostname belongs at the portal's root. */
export function AdminNotFound() {
  return <Navigate to={ADMIN_ROUTES.root} replace />;
}
