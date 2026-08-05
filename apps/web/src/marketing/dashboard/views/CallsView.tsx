import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile } from '@/components/ui/IconTile';
import { SearchInput } from '@/components/ui/SearchInput';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import { Pagination } from '@/components/ui/pagination';
import { ChevronRightIcon, PhoneIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { calls } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';

/**
 * The Calls page, matching `features/calls/CallsPage`: one card holding the
 * filter bar, the call log and the pagination footer.
 *
 * The search filters the fixtures for real — it is two lines of `filter`, and a
 * preview whose search box does nothing is the fastest way to tell a visitor
 * they are looking at a picture.
 */
export function CallsView() {
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? calls.filter((call) =>
        `${call.name} ${call.phone} ${call.city} ${call.summary}`.toLowerCase().includes(needle),
      )
    : calls;

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Calls"
          description="Every inbound call answered by your AI receptionist."
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          <FilterBar>
            <SearchInput
              className="sm:max-w-sm sm:flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by caller or number…"
              aria-label="Search calls"
            />
          </FilterBar>

          {!visible.length ? (
            <p className="px-6 py-10 text-center text-body text-ink-muted">
              No calls match “{search.trim()}”.
            </p>
          ) : (
            <StaggerList className="divide-y divide-line-subtle">
              {visible.map((call) => (
                <StaggerRow key={call.id}>
                  <div className="group flex items-center gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2">
                    <IconTile
                      icon={call.isEmergency ? ShieldExclamationIcon : PhoneIcon}
                      tone={call.isEmergency ? 'emergency' : 'brand'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-body font-medium text-ink">
                          {call.name}
                        </span>
                        <EnumStatusText value={call.outcome} />
                        {/* The product renders a second Emergency label beside
                            the outcome, for the case where a call is flagged as
                            an emergency but resolved to something else. Here the
                            emergency fixture's outcome *is* `EMERGENCY`, so
                            printing both put the word on the row twice. */}
                        {call.isEmergency && call.outcome !== 'EMERGENCY' && (
                          <StatusText tone="danger">Emergency</StatusText>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 break-words text-small text-ink-muted">
                        {call.summary}
                      </p>
                    </div>
                    {/* Two lines, as the product has them. A third carrying the
                        phone number was the widest thing in this column and, at
                        342px, it took the width the caller's name needed —
                        "Dana Whitfield" truncated to "Dana W…" so a number
                        already shown on the Customers page could be repeated
                        here. */}
                    <div className="shrink-0 text-right">
                      <p className="font-num text-small text-ink-muted">{call.duration}</p>
                      <p className="mt-0.5 text-caption text-ink-faint">{call.at}</p>
                    </div>
                    <ChevronRightIcon
                      className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                </StaggerRow>
              ))}
            </StaggerList>
          )}

          <Pagination
            pagination={{
              page: 1,
              limit: 20,
              totalRecords: 1284,
              totalPages: 65,
              hasNextPage: true,
              hasPreviousPage: false,
            }}
            onPageChange={() => undefined}
          />
        </Card>
      </Reveal>
    </div>
  );
}
