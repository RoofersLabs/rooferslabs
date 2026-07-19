import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, PhoneMissed, Search } from 'lucide-react';
import { useCalls } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDateTime, formatDuration, formatPhone } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';

export function CallsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const calls = useCalls({ page, search: debouncedSearch || undefined });

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Every inbound call answered by your AI receptionist."
      />

      <div className="card overflow-hidden">
        <div className="border-b border-line-subtle p-4">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by caller or number…"
              className="focus-ring h-9 w-full rounded-lg border border-line pl-9 pr-3 text-sm"
              aria-label="Search calls"
            />
          </div>
        </div>

        {calls.isLoading ? (
          <ListSkeleton />
        ) : calls.isError ? (
          <ErrorState
            title="Couldn’t load calls"
            message={(calls.error as Error).message}
            onRetry={() => void calls.refetch()}
          />
        ) : !calls.data?.items.length ? (
          <EmptyState
            icon={PhoneMissed}
            title="No calls yet"
            description="Calls will appear here as soon as your forwarded number starts ringing."
          />
        ) : (
          <>
            <ul className="divide-y divide-line-subtle">
              {calls.data.items.map((call) => {
                const row = (
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
                      <Phone className="h-4 w-4 text-brand-700" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {call.customer?.fullName ?? formatPhone(call.fromNumber)}
                        </span>
                        <EnumBadge value={call.conversation?.outcome ?? call.status} />
                        {call.conversation?.isEmergency && <EnumBadge value="EMERGENCY" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {call.conversation?.summary ?? formatPhone(call.fromNumber)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-ink">
                        {formatDuration(call.durationSeconds)}
                      </p>
                      <p className="text-[11px] text-ink-faint">{formatDateTime(call.createdAt)}</p>
                    </div>
                  </div>
                );

                return (
                  <li key={call.id}>
                    {call.conversation ? (
                      <Link
                        to={`/conversations/${call.conversation.id}`}
                        className="focus-ring block hover:bg-surface-2"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination pagination={calls.data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
