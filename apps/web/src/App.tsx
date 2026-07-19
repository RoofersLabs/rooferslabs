import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { OnboardingStep } from '@rooferslabs/shared';
import { useSessionQuery } from '@/hooks/queries';
import { FullScreenSpinner } from '@/components/ui/spinner';
import { AppLayout } from '@/layouts/AppLayout';
import { LandingPage } from '@/features/landing/LandingPage';
import { SignInPage, SignUpPage } from '@/features/auth/AuthPages';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CallsPage } from '@/features/calls/CallsPage';
import { ConversationDetailPage } from '@/features/calls/ConversationDetailPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { KnowledgePage } from '@/features/knowledge/KnowledgePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';

/**
 * Guards the authenticated area: loads the session, then routes users without a
 * completed company through onboarding (the guided customer journey).
 */
function Protected({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();
  const session = useSessionQuery(Boolean(isLoaded && isSignedIn));

  if (!isLoaded) return <FullScreenSpinner />;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  if (session.isLoading) return <FullScreenSpinner label="Loading your workspace…" />;
  if (session.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-h5 text-ink">We couldn’t load your workspace</h1>
          <p className="mt-2 text-body text-ink-muted">
            {(session.error as Error).message || 'Please try again in a moment.'}
          </p>
          <button
            className="focus-ring mt-4 rounded-md bg-accent px-4 py-2 text-button font-semibold text-ink-on-brand shadow-button transition-all duration-fast hover:bg-accent-hover active:scale-[0.98]"
            onClick={() => session.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const company = session.data?.company ?? null;
  const onboardingComplete = company?.onboardingStep === OnboardingStep.COMPLETE;
  const onOnboardingRoute = location.pathname.startsWith('/onboarding');

  if (!onboardingComplete && !onOnboardingRoute) return <Navigate to="/onboarding" replace />;
  if (onboardingComplete && onOnboardingRoute) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      <Route
        path="/onboarding"
        element={
          <Protected>
            <OnboardingPage />
          </Protected>
        }
      />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/conversations/:id" element={<ConversationDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:tab" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
