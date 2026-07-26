import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/auth/stages';

/** Shared centered shell for the Clerk auth widgets. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to={ROUTES.marketing} className="mb-8 text-lg font-bold">
        RoofersLabs
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

export function SignInPage() {
  const afterAuthUrl = useAfterAuthUrl();
  return (
    <AuthShell>
      <SignIn path={ROUTES.signIn} signUpUrl={ROUTES.signUp} fallbackRedirectUrl={afterAuthUrl} />
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
