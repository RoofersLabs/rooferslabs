import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Phone, PhoneMissed, ShieldAlert } from 'lucide-react';
import { useCalls } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDateTime, formatDuration, formatPhone } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile } from '@/components/ui/IconTile';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';
import { CallStatusLabel } from './CallStatusLabel';

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

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            className="sm:max-w-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by caller or number…"
            aria-label="Search calls"
          />
        </FilterBar>

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
                const isEmergency = call.conversation?.isEmergency ?? false;
                const row = (
                  <div className="group flex items-center gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2">
                    <IconTile
                      icon={isEmergency ? ShieldAlert : Phone}
                      tone={isEmergency ? 'emergency' : 'brand'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* `min-w-0` lets the name actually truncate: without it
                            a nowrap flex item cannot compress past its text and
                            spills out of the row instead. */}
                        <span className="min-w-0 truncate text-body font-medium text-ink">
                          {call.customer?.fullName ?? formatPhone(call.fromNumber)}
                        </span>
                        <CallStatusLabel value={call.conversation?.outcome ?? call.status} />
                        {isEmergency && <CallStatusLabel value="EMERGENCY" />}
                      </div>
                      {/* Wraps over two lines instead of truncating to one.
                          `break-words` keeps an unbroken token (a long URL or
                          address) from setting a wide min-content floor. */}
                      <p className="mt-0.5 line-clamp-2 text-small break-words text-ink-muted">
                        {call.conversation?.summary ?? formatPhone(call.fromNumber)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-num text-small text-ink-muted">
                        {formatDuration(call.durationSeconds)}
                      </p>
                      <p className="mt-0.5 text-caption text-ink-faint">
                        {formatDateTime(call.createdAt)}
                      </p>
                    </div>
                    {call.conversation && (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                        aria-hidden
                      />
                    )}
                  </div>
                );

                return (
                  <li key={call.id}>
                    {call.conversation ? (
                      <Link
                        to={`/conversations/${call.conversation.id}`}
                        className="focus-ring block"
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
      </Card>
    </div>
  );
}
