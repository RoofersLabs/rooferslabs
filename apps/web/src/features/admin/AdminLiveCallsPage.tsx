import { PhoneCall, ShieldAlert } from 'lucide-react';
import { useAdminLiveCalls } from '@/hooks/queries';
import { formatPhone, humanizeEnum } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EnumStatusText } from '@/components/ui/StatusText';
import { IconTile } from '@/components/ui/IconTile';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

/** Seconds elapsed, rendered as m:ss. Recomputed on every poll. */
function elapsed(since: string | null): string {
  if (!since) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Calls in flight across every tenant.
 *
 * Refreshed by polling every five seconds rather than over a socket: a call
 * lasts minutes, the portal is open on one screen, and a poll needs no
 * reconnection handling or second transport to maintain.
 */
export function AdminLiveCallsPage() {
  const calls = useAdminLiveCalls();

  return (
    <Card as="section" className="overflow-hidden rounded-md">
      <CardHeader className="items-center">
        <CardTitle as="h2">Live calls</CardTitle>
        <span className="text-caption text-ink-faint">Refreshes every 5s</span>
      </CardHeader>

      {calls.isLoading ? (
        <ListSkeleton rows={4} />
      ) : calls.isError ? (
        <ErrorState
          title="Couldn’t load live calls"
          message={(calls.error as Error).message}
          onRetry={() => void calls.refetch()}
        />
      ) : !calls.data?.length ? (
        <EmptyState
          icon={PhoneCall}
          title="No calls in progress"
          description="Calls appear here the moment the AI picks up, anywhere on the platform."
        />
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {calls.data.map((call) => {
            const emergency = call.conversation?.isEmergency ?? false;
            return (
              <li key={call.id} className="flex items-center gap-4 px-6 py-4">
                <IconTile
                  icon={emergency ? ShieldAlert : PhoneCall}
                  tone={emergency ? 'emergency' : 'brand'}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">
                    {call.company?.name ?? 'Unknown company'}
                  </span>
                  <span className="font-num mt-0.5 block truncate text-small text-ink-muted">
                    {formatPhone(call.fromNumber)}
                  </span>
                </span>
                <span className="flex w-28 shrink-0 flex-col items-end text-right sm:w-36">
                  <EnumStatusText value={call.status} className="max-w-full truncate" />
                  <span className="font-num mt-1 text-small text-ink-muted">
                    {elapsed(call.startedAt ?? call.createdAt)}
                  </span>
                  {emergency && (
                    <span className="mt-0.5 text-caption font-semibold text-emergency">
                      Emergency
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {calls.data?.length ? (
        <CardContent className="border-t border-line-subtle">
          <p className="text-caption text-ink-faint">
            {calls.data.length} call{calls.data.length === 1 ? '' : 's'} in progress ·{' '}
            {humanizeEnum('IN_PROGRESS')} and ringing included
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
