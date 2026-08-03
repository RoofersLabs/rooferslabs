import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { useAdminCompanies } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn, timeAgo } from '@/lib/utils';
import { EnumStatusText } from '@/components/ui/StatusText';
import { REFINED_CARD, REFINED_FIELD } from '@/components/ui/refinedControls';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ADMIN_ROUTES } from './routes';

export function AdminCompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const navigate = useNavigate();
  const companies = useAdminCompanies({
    page,
    search: debounced || undefined,
  });

  const total = companies.data?.pagination.totalRecords;

  return (
    <div>
      {/* The portal opens here, so the page says what it is and how much of it
          there is. `PageHeader` is the same component every customer page opens
          with — nothing new, just used on a surface that previously had no
          title at all because a dashboard sat above it. */}
      <PageHeader
        className="mb-4"
        title="Companies"
        description={
          total === undefined
            ? 'Every company on the platform.'
            : `${total} ${total === 1 ? 'company' : 'companies'} on the platform.`
        }
      />

      <Card className={cn('overflow-hidden', REFINED_CARD)}>
        <FilterBar>
          <SearchInput
            className="sm:max-w-xs"
            inputClassName={REFINED_FIELD}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search company, email, phone…"
            aria-label="Search companies"
          />
        </FilterBar>

        {companies.isLoading ? (
          <ListSkeleton />
        ) : companies.isError ? (
          <ErrorState
            title="Couldn’t load companies"
            message={(companies.error as Error).message}
            onRetry={() => void companies.refetch()}
          />
        ) : !companies.data?.items.length ? (
          // A filtered-out list and a genuinely empty platform look identical
          // otherwise, and only one of them is worth investigating.
          <EmptyState
            icon={Building2}
            title={search ? 'No companies match' : 'No companies yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'Companies appear here as soon as they sign up.'
            }
          />
        ) : (
          <>
            {/* Phones get the stacked list; the table's container scrolls
              sideways, which is the wrong shape for a hand. */}
            <ul className="divide-y divide-line-subtle border-t border-line-subtle lg:hidden">
              {companies.data.items.map((company) => (
                <li key={company.id}>
                  <Link
                    to={ADMIN_ROUTES.company(company.id)}
                    className="focus-ring flex items-center gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {company.name}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {company.ownerEmail ?? '—'}
                      </span>
                      <span className="font-num mt-0.5 block text-caption text-ink-faint">
                        {company.callsToday} calls · {company.leadsToday} leads ·{' '}
                        {company.appointmentsToday} appts
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <EnumStatusText value={company.status} />
                      <ChevronRight className="h-4 w-4 text-ink-faint" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    {/* The three activity columns are numbers: right-aligned so
                      digits line up on the decimal, which is what makes a
                      column of figures scannable rather than ragged. */}
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Appts</TableHead>
                    <TableHead className="text-right">Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.data.items.map((company) => (
                    <TableRow
                      key={company.id}
                      onClick={() => navigate(ADMIN_ROUTES.company(company.id))}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        {/* A real link, not just a row handler: the name is the
                          thing being opened, so it has to be reachable by
                          keyboard and openable in a new tab. `stopPropagation`
                          keeps the click from also firing the row's navigate. */}
                        <Link
                          to={ADMIN_ROUTES.company(company.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="focus-ring rounded-xs font-medium text-ink transition-colors duration-fast hover:text-accent"
                        >
                          {company.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        <span className="block truncate">{company.ownerName ?? '—'}</span>
                        <span className="block truncate text-caption text-ink-faint">
                          {company.ownerEmail ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <EnumStatusText value={company.status} />
                      </TableCell>
                      <TableCell className="font-num text-right tabular-nums">
                        {company.callsToday}
                      </TableCell>
                      <TableCell className="font-num text-right tabular-nums">
                        {company.leadsToday}
                      </TableCell>
                      <TableCell className="font-num text-right tabular-nums">
                        {company.appointmentsToday}
                      </TableCell>
                      <TableCell className="text-right text-caption text-ink-faint">
                        {company.lastActiveAt ? timeAgo(company.lastActiveAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination pagination={companies.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
