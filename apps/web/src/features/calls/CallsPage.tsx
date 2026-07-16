import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, PhoneMissed, Search } from 'lucide-react';
import { useCalls } from '@/hooks/queries';
import { formatDateTime, formatDuration, formatPhone } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/Badge';
import { LoadingBlock } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';

export function CallsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const calls = useCalls({ page, search: search || undefined });

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Every inbound call answered by your AI receptionist."
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by caller or number…"
              className="focus-ring h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm"
              aria-label="Search calls"
            />
          </div>
        </div>

        {calls.isLoading ? (
          <LoadingBlock />
        ) : !calls.data?.items.length ? (
          <EmptyState
            icon={PhoneMissed}
            title="No calls yet"
            description="Calls will appear here as soon as your forwarded number starts ringing."
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {calls.data.items.map((call) => {
                const row = (
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50">
                      <Phone className="h-4 w-4 text-brand-700" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {call.customer?.fullName ?? formatPhone(call.fromNumber)}
                        </span>
                        <EnumBadge value={call.conversation?.outcome ?? call.status} />
                        {call.conversation?.isEmergency && <EnumBadge value="EMERGENCY" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {call.conversation?.summary ?? formatPhone(call.fromNumber)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-slate-700">
                        {formatDuration(call.durationSeconds)}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDateTime(call.createdAt)}</p>
                    </div>
                  </div>
                );

                return (
                  <li key={call.id}>
                    {call.conversation ? (
                      <Link
                        to={`/conversations/${call.conversation.id}`}
                        className="focus-ring block hover:bg-slate-50"
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
