import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/auth/stages';
import { Logo } from '@/components/Brand';

/** Shared centered shell for the Clerk auth widgets. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4 py-12">
      <Link
        to={ROUTES.marketing}
        className="focus-ring mb-8 flex items-center gap-2.5 rounded-md"
        aria-label="rooferslabs home"
      >
        <Logo size="lg" className="text-brand-950" />
      </Link>
      {children}
    </div>
  );
}

/**
 * Where Clerk sends the browser once authentication succeeds.
 *
 * Sign-in and sign-up deliberately share one destination. They used to differ
 * (`/dashboard` and `/onboarding`), which put a second, stale copy of the flow
 * rules in the auth widgets — a returning user who had never paid was sent to a
 * dashboard they could not enter. The route guard decides the real destination
 * from the session, so this only has to name a guarded route and let the guard
 * correct it in one hop.
 *
 * A visitor bounced here from a protected URL returns to it; the guard still
 * has the final say on whether they may enter.
 */
function useAfterAuthUrl(): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from !== ROUTES.signIn && from !== ROUTES.signUp ? from : ROUTES.dashboard;
}

/**
 * `afterAuthUrl` overrides where Clerk lands the browser once authentication
 * succeeds. The admin hostname passes `/admin`, so the same widget serves both
 * surfaces rather than a second copy existing for the portal. Left unset, the
 * customer rules below are unchanged.
 */
export function SignInPage({ afterAuthUrl }: { afterAuthUrl?: string } = {}) {
  const derived = useAfterAuthUrl();
  return (
    <AuthShell>
      <SignIn
        path={ROUTES.signIn}
        signUpUrl={ROUTES.signUp}
        fallbackRedirectUrl={afterAuthUrl ?? derived}
      />
    </AuthShell>
  );
}

export function SignUpPage() {
  const afterAuthUrl = useAfterAuthUrl();
  return (
    <AuthShell>
      <SignUp path={ROUTES.signUp} signInUrl={ROUTES.signIn} fallbackRedirectUrl={afterAuthUrl} />
    </AuthShell>
  );
}
