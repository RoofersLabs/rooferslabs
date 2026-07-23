import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';

/** Shared centered shell for the Clerk auth widgets. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="mb-8 text-lg font-bold">
        RoofersLabs
      </Link>
      {children}
    </div>
  );
}

/** Login. */
export function SignInPage() {
  return (
    <AuthShell>
      <SignIn path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </AuthShell>
  );
}

/** Register. New accounts land on onboarding to create their organization. */
export function SignUpPage() {
  return (
    <AuthShell>
      <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthShell>
  );
}
