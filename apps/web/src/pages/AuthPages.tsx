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
        className="focus-ring mb-8 flex items-center gap-2.5"
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
 * The one part of the product whose buttons this codebase does not own.
 *
 * Clerk renders sign-in and sign-up itself, so `Button` never runs here and the
 * pill would have stopped at the authentication screen — the first screen
 * anyone sees. Clerk's `appearance.elements` takes Tailwind classes, which is
 * the same mechanism `AdminLayout` already uses for the avatar, so the radius
 * is stated here rather than the widget being rebuilt.
 *
 * Radius only. Clerk's own colour, height and spacing are left exactly as they
 * are: matching the shape is what makes the screen read as ours, and going
 * further would be maintaining a private fork of someone else's design system
 * against class names they are free to change. If Clerk renames these, the
 * override silently stops applying — the button keeps working and reverts to
 * their radius, which is the right failure for a purely visual override.
 */
const CLERK_PILL_BUTTONS = {
  elements: {
    formButtonPrimary: 'rounded-full',
    socialButtonsBlockButton: 'rounded-full',
    formButtonReset: 'rounded-full',
  },
} as const;

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
        appearance={CLERK_PILL_BUTTONS}
      />
    </AuthShell>
  );
}

export function SignUpPage() {
  const afterAuthUrl = useAfterAuthUrl();
  return (
    <AuthShell>
      <SignUp
        path={ROUTES.signUp}
        signInUrl={ROUTES.signIn}
        fallbackRedirectUrl={afterAuthUrl}
        appearance={CLERK_PILL_BUTTONS}
      />
    </AuthShell>
  );
}
