import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

/**
 * Temporary landing page. The marketing site was removed ahead of the product
 * redesign; this exists only so `/` resolves and offers a way into the app.
 */
export function LandingPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold">RoofersLabs</h1>
      <p className="mt-3 text-gray-600">
        AI front office for roofing companies. Your receptionist answers every call, qualifies the
        lead, and books the appointment.
      </p>

      <div className="mt-8 flex gap-3">
        {isSignedIn ? (
          <Link
            to="/dashboard"
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link
              to="/sign-up"
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Create account
            </Link>
            <Link
              to="/sign-in"
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
