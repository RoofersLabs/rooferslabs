import { useDashboard } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';

/**
 * Dashboard placeholder. The previous dashboard UI was removed ahead of the
 * redesign; this reads the same `/dashboard/overview` endpoint so the backend
 * path stays exercised.
 *
 * The "finish setup" card that used to live here is gone: completing onboarding
 * is now the last step of the wizard, which runs before the payment wall, so
 * reaching this page already implies setup is complete.
 */
export function DashboardPage() {
  const overview = useDashboard();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="rounded border border-gray-200 bg-white p-6">
        <h2 className="font-semibold">Overview</h2>
        {overview.isLoading ? (
          <p className="mt-2 text-sm text-gray-600">Loading…</p>
        ) : overview.isError ? (
          <p className="mt-2 text-sm text-red-600">
            {(overview.error as ApiError).message || 'Could not load the overview.'}
          </p>
        ) : (
          <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-4 text-xs">
            {JSON.stringify(overview.data, null, 2)}
          </pre>
        )}
      </div>

      <p className="text-sm text-gray-600">
        This is a temporary placeholder. Calls, customers, appointments, and the knowledge base are
        still served by the API and will return with the redesigned interface.
      </p>
    </div>
  );
}
