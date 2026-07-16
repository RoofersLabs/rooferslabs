import { SignIn, SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { HardHat } from 'lucide-react';

/** Shared centered shell for the Clerk auth widgets. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10">
      <Link to="/" className="focus-ring mb-8 flex items-center gap-2.5 rounded-lg">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
          <HardHat className="h-6 w-6 text-white" aria-hidden />
        </span>
        <span className="text-xl font-bold text-white">RoofersLabs</span>
      </Link>
      {children}
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthShell>
  );
}

export function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
    </AuthShell>
  );
}
