import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link, useLocation } from 'react-router-dom';
import { HardHat } from 'lucide-react';
import { ROUTES } from '@/auth/stages';

/** Shared centered shell for the Clerk auth widgets. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4 py-12">
      <Link
        to={ROUTES.marketing}
        className="focus-ring mb-8 flex items-center gap-2.5 rounded-md"
        aria-label="RoofersLabs home"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-ink-on-brand shadow-button">
          <HardHat className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-h5 font-bold text-ink">RoofersLabs</span>
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
