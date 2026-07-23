import { OnboardingStep } from '@rooferslabs/shared';
import { useCompleteOnboarding, useDashboard } from '@/hooks/queries';
import { useSessionStore } from '@/state/session.store';
import { ApiError } from '@/lib/api-client';

/**
 * Dashboard placeholder. The previous dashboard UI was removed ahead of the
 * redesign; this reads the same `/dashboard/overview` endpoint so the backend
 * path stays exercised, and carries the one action the flow still needs —
 * finishing setup, which provisions the company's AI phone number.
 */
export function DashboardPage() {
  const company = useSessionStore((s) => s.company);
  const overview = useDashboard();
  const completeOnboarding = useCompleteOnboarding();

  const setupComplete = company?.onboardingStep === OnboardingStep.COMPLETE;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {!setupComplete && (
        <div className="rounded border border-gray-200 bg-white p-6">
          <h2 className="font-semibold">Finish setup</h2>
          <p className="mt-1 text-sm text-gray-600">
            Activate your AI receptionist and provision your dedicated phone number.
          </p>
          <button
            type="button"
            onClick={() => completeOnboarding.mutate()}
            disabled={completeOnboarding.isPending}
            className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {completeOnboarding.isPending ? 'Activating…' : 'Activate receptionist'}
          </button>
          {completeOnboarding.isError && (
            <p className="mt-2 text-sm text-red-600">
              {(completeOnboarding.error as ApiError).message}
            </p>
          )}
        </div>
      )}

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
