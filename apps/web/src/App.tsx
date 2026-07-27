import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import { AccessProvider } from '@/auth/AccessProvider';
import { RouteGuard } from '@/auth/RouteGuard';
import { ROUTES } from '@/auth/stages';
import { currentSurface } from '@/lib/host';
import { ADMIN_ROUTES } from '@/features/admin/routes';
import { AuthenticatedProviders } from '@/providers/AppProviders';
import { AppLayout } from '@/layouts/AppLayout';
import { FullScreenSpinner } from '@/components/ui/spinner';
import { SignInPage, SignUpPage } from '@/pages/AuthPages';
import { OnboardingLayout } from '@/pages/onboarding/OnboardingLayout';
import { PaymentPage } from '@/pages/PaymentPage';
import { BillingPage } from '@/pages/BillingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CallsPage } from '@/features/calls/CallsPage';
import { ConversationDetailPage } from '@/features/calls/ConversationDetailPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';
import { AppointmentsPage } from '@/features/appointments/AppointmentsPage';
import { KnowledgePage } from '@/features/knowledge/KnowledgePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

// The marketing site is the only route an unauthenticated visitor sees, and
// the only one the application's own bundle never needs. Splitting it keeps
// each audience off the other's critical path.
const MarketingPage = lazy(() =>
  import('@/marketing/MarketingPage').then((m) => ({ default: m.MarketingPage })),
);

// The internal admin portal. Lazy so a customer never downloads a byte of it —
// and irrelevant to security either way, since every one of its requests is
// refused by the API unless the caller holds the platform role.
const AdminLayout = lazy(() =>
  import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminDashboardPage = lazy(() =>
  import('@/features/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminCompaniesPage = lazy(() =>
  import('@/features/admin/AdminCompaniesPage').then((m) => ({ default: m.AdminCompaniesPage })),
);
const AdminCompanyDetailPage = lazy(() =>
  import('@/features/admin/AdminCompanyDetailPage').then((m) => ({
    default: m.AdminCompanyDetailPage,
  })),
);
const AdminLiveCallsPage = lazy(() =>
  import('@/features/admin/AdminLiveCallsPage').then((m) => ({ default: m.AdminLiveCallsPage })),
);
const AdminAnalyticsPage = lazy(() =>
  import('@/features/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })),
);
const AdminSettingsPage = lazy(() =>
  import('@/features/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
);
const AdminAccessGate = lazy(() =>
  import('@/features/admin/AdminAccessGate').then((m) => ({ default: m.AdminAccessGate })),
);
const AdminNotFound = lazy(() =>
  import('@/features/admin/AdminAccessGate').then((m) => ({ default: m.AdminNotFound })),
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
/**
 * The customer application: marketing, auth, onboarding, billing, dashboard.
 * Unchanged, and not mounted at all on the admin hostname.
 */
function CustomerApp() {
  return (
    <Routes>
      {/* The public marketing site. Deliberately outside the auth stack so a
          page with no session never waits on an auth SDK to paint.

          On the admin hostname the root is the portal instead. CloudFront
          already redirects `admin.<domain>/` at the edge, before any HTML is
          served — this is the backstop for the paths that never reach it: local
          development, the raw *.cloudfront.net domain, and a client-side
          navigation back to `/`, which performs no request at all. */}
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

        {/* The application proper — one guard, one shell, every feature page
            beneath it. `ROUTES.dashboard` is the canonical landing route the
            stage resolver sends a finished tenant to. */}
        <Route element={<RouteGuard route={ROUTES.dashboard} />}>
          <Route element={<AppLayout />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.calls} element={<CallsPage />} />
            <Route path={`${ROUTES.conversations}/:id`} element={<ConversationDetailPage />} />
            <Route path={ROUTES.customers} element={<CustomersPage />} />
            <Route path={`${ROUTES.customers}/:id`} element={<CustomerDetailPage />} />
            <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
            <Route path={ROUTES.knowledge} element={<KnowledgePage />} />
            <Route path={ROUTES.notifications} element={<NotificationsPage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
            <Route path={`${ROUTES.settings}/:tab`} element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/**
 * The admin application.
 *
 * A separate route tree, not a branch inside the customer one. The portal used
 * to be mounted under `RouteGuard route={ROUTES.dashboard}`, which required the
 * *customer* stage `app` — so a staff account with no company resolved to
 * `onboarding` and was sent into the setup wizard, never reaching the portal at
 * all. Platform staff are not tenants, and routing them through a tenant's
 * lifecycle was wrong in principle as well as in effect.
 *
 * Only two routes exist here: sign-in, and the portal. Everything else lands on
 * the portal, so no customer surface is reachable on this hostname.
 */
function AdminApp() {
  return (
    <Routes>
      <Route element={<AuthenticatedShell />}>
        {/* The same Clerk widget the customer app uses, told where to return. */}
        <Route path="/sign-in/*" element={<SignInPage afterAuthUrl={ADMIN_ROUTES.root} />} />

        <Route
          element={
            <Suspense fallback={<FullScreenSpinner label="Loading…" />}>
              <AdminAccessGate />
            </Suspense>
          }
        >
          <Route path={ADMIN_ROUTES.root} element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
            <Route path="live-calls" element={<AdminLiveCallsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>

        {/* `/` included: CloudFront redirects it at the edge, but a client-side
            navigation never reaches the edge. */}
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}

/**
 * One build, two applications, chosen by hostname.
 *
 * Read once at mount because a document cannot change hostname without
 * reloading — and read here, at the root, so the decision is made before any
 * route is mounted rather than inside one.
 */
export function App() {
  return currentSurface() === 'admin' ? <AdminApp /> : <CustomerApp />;
}
