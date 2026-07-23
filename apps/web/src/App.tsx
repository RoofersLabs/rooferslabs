import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useSessionQuery } from '@/hooks/queries';
import { AppLayout } from '@/layouts/AppLayout';
import { SignInPage, SignUpPage } from '@/pages/AuthPages';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { PaymentPage } from '@/pages/PaymentPage';
import { BillingPage } from '@/pages/BillingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
      {label}
    </div>
  );
}

/**
 * Guards the authenticated area and enforces the onboarding flow:
 * authenticate → create organization → pay → use the application.
 *
 * The payment wall here is a convenience, not the enforcement point: the API
 * rejects every gated request from an unsubscribed tenant regardless of what
 * the client does.
 */
function Protected({
  children,
  requireSubscription = true,
}: {
  children: React.ReactNode;
  requireSubscription?: boolean;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();
  const session = useSessionQuery(Boolean(isLoaded && isSignedIn));

  if (!isLoaded) return <Loading />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  if (session.isLoading) return <Loading label="Loading your workspace…" />;
  if (session.isError) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-bold">We couldn’t load your workspace</h1>
        <p className="mt-2 text-sm text-gray-600">
          {(session.error as Error).message || 'Please try again in a moment.'}
        </p>
        <button
          type="button"
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => void session.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasCompany = Boolean(session.data?.company);
  const isSubscribed = session.data?.subscription?.isActive ?? false;
  const onOnboarding = location.pathname === '/onboarding';

  if (!hasCompany && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (hasCompany && onOnboarding) {
    return <Navigate to={isSubscribed ? '/dashboard' : '/payment'} replace />;
  }
  if (requireSubscription && !isSubscribed) return <Navigate to="/payment" replace />;

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* The application has no public surface: the root sends every visitor
          into the authenticated area, where the guard chain below routes them
          to sign-in, onboarding or payment as their session requires. */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      {/* Reachable before payment — this is where a blocked tenant subscribes. */}
      <Route
        path="/onboarding"
        element={
          <Protected requireSubscription={false}>
            <OnboardingPage />
          </Protected>
        }
      />
      <Route
        path="/payment"
        element={
          <Protected requireSubscription={false}>
            <PaymentPage />
          </Protected>
        }
      />
      <Route
        path="/billing"
        element={
          <Protected requireSubscription={false}>
            <BillingPage />
          </Protected>
        }
      />

      {/* Requires an active subscription. */}
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
