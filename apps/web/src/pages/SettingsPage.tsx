import { Link } from 'react-router-dom';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useReceptionistStatus, useSetReceptionistEnabled } from '@/hooks/queries';
import { useAccess } from '@/auth/AccessProvider';
import { ROUTES } from '@/auth/stages';
import { ApiError } from '@/lib/api-client';

/**
 * Settings placeholder. Keeps the two controls that are operationally
 * meaningful — the receptionist master switch and push notifications — while
 * the full settings surface waits for the redesign.
 */
export function SettingsPage() {
  const { company, paymentsEnabled } = useAccess();
  const status = useReceptionistStatus();
  const setEnabled = useSetReceptionistEnabled();
  const push = usePushNotifications();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded border border-gray-200 bg-white p-6">
        <h2 className="font-semibold">Organization</h2>
        <p className="mt-1 text-sm text-gray-600">{company?.name ?? '—'}</p>
      </section>

      <section className="rounded border border-gray-200 bg-white p-6">
        <h2 className="font-semibold">AI receptionist</h2>
        {status.isLoading ? (
          <p className="mt-2 text-sm text-gray-600">Loading…</p>
        ) : status.isError ? (
          <p className="mt-2 text-sm text-red-600">
            {(status.error as ApiError).message || 'Could not load receptionist status.'}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Currently {status.data?.enabled ? 'answering calls' : 'not answering calls'}.
            </p>
            <button
              type="button"
              onClick={() => setEnabled.mutate(!status.data?.enabled)}
              disabled={setEnabled.isPending}
              className="mt-4 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {status.data?.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-6">
        <h2 className="font-semibold">Push notifications</h2>
        {push.status === 'unsupported' ? (
          <p className="mt-1 text-sm text-gray-600">Not available in this browser.</p>
        ) : push.status === 'denied' ? (
          <p className="mt-1 text-sm text-gray-600">
            Blocked in your browser settings. Re-allow notifications for this site to enable them.
          </p>
        ) : (
          <button
            type="button"
            onClick={() =>
              void (push.status === 'subscribed' ? push.unsubscribe() : push.subscribe())
            }
            disabled={push.busy || push.status === 'loading'}
            className="mt-4 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {push.status === 'subscribed' ? 'Disable' : 'Enable'}
          </button>
        )}
      </section>

      {paymentsEnabled && (
        <section className="rounded border border-gray-200 bg-white p-6">
          <h2 className="font-semibold">Billing</h2>
          <Link to={ROUTES.billing} className="mt-2 inline-block text-sm underline">
            Manage your subscription
          </Link>
        </section>
      )}
    </div>
  );
}
