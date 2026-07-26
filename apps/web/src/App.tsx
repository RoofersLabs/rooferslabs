import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { AccessProvider } from '@/auth/AccessProvider';
import { RouteGuard } from '@/auth/RouteGuard';
import { ROUTES } from '@/auth/stages';
import { AuthenticatedProviders } from '@/providers/AppProviders';
import { AppLayout } from '@/layouts/AppLayout';
import { SignInPage, SignUpPage } from '@/pages/AuthPages';
import { OnboardingLayout } from '@/pages/onboarding/OnboardingLayout';
import { PaymentPage } from '@/pages/PaymentPage';
import { BillingPage } from '@/pages/BillingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// The marketing site is the only route an unauthenticated visitor sees, and
// the only one the application's own bundle never needs. Splitting it keeps
// each audience off the other's critical path.
const MarketingPage = lazy(() =>
  import('@/marketing/MarketingPage').then((m) => ({ default: m.MarketingPage })),
);

/**
 * Mounts the auth stack and the access context for every route beneath the
 * public marketing site.
 */
function AuthenticatedShell() {
  return (
    <AuthenticatedProviders>
      <AccessProvider>
        <Outlet />
      </AccessProvider>
    </AuthenticatedProviders>
  );
}

/**
 * The route table, and the whole of the application's routing policy.
 *
 * Every guarded path sits under a `<RouteGuard>` naming the route it protects;
 * who may view it comes from the access table on the context. No page component
 * redirects on its own — there is exactly one decision site (`redirectFor`) and
 * one place that renders its outcome (`RouteGuard`), which is what makes the flow
 *
 *     visitor → sign in → onboarding (4 steps) → payment → dashboard
 *
 * enforceable in both directions without any page knowing about the others.
 *
 * The payment step drops out of that chain when the API reports payments as
 * disabled, leaving onboarding → dashboard. The route entries below stay exactly
 * as they are: the access table denies every stage, so the guard turns them away
 * on its own and the Stripe pages remain wired up for the day billing returns.
 */
export function App() {
  return (
    <Routes>
      {/* The public marketing site. Deliberately outside the auth stack so a
          page with no session never waits on an auth SDK to paint. */}
      <Route
        path={ROUTES.marketing}
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <MarketingPage />
          </Suspense>
        }
      />

      <Route element={<AuthenticatedShell />}>
        {/* Signed out only — a signed-in visitor is moved to their stage. */}
        <Route element={<RouteGuard route={ROUTES.signIn} />}>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
        </Route>

        {/* Setup. Steps are URL-addressable so progress survives a reload; the
            layout resolves the slug and resumes at the persisted step when it
            is missing, unknown, or not yet unlocked. */}
        <Route element={<RouteGuard route={ROUTES.onboarding} />}>
          <Route path={ROUTES.onboarding} element={<OnboardingLayout />} />
          <Route path={`${ROUTES.onboarding}/:step`} element={<OnboardingLayout />} />
        </Route>

        {/* The payment wall. Unreachable once subscribed — that guard is the
            reason a paying tenant never sees this page again. */}
        <Route element={<RouteGuard route={ROUTES.payment} />}>
          <Route path={ROUTES.payment} element={<PaymentPage />} />
        </Route>

        {/* Billing is reachable while unpaid *and* while paying: Stripe returns
            here after checkout, before the activation webhook has landed. */}
        <Route element={<RouteGuard route={ROUTES.billing} />}>
          <Route path={ROUTES.billing} element={<BillingPage />} />
        </Route>

        {/* The application proper. */}
        <Route element={<RouteGuard route={ROUTES.dashboard} />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
