import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, ChevronRight } from 'lucide-react';
import { useAdminCompanies } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumStatusText } from '@/components/ui/StatusText';
import { REFINED_CARD, REFINED_FIELD } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
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

const FILTERS = [
  { key: undefined, label: 'All' },
  { key: 'TRIAL', label: 'Trial' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
] as const;

export function AdminCompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [subscription, setSubscription] = useState<string | undefined>(undefined);
  const debounced = useDebouncedValue(search);
  const navigate = useNavigate();
  const companies = useAdminCompanies({
    page,
    search: debounced || undefined,
    subscription,
  });

  return (
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
        <div className="flex gap-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter.label}
              size="sm"
              variant={subscription === filter.key ? 'primary' : 'ghost'}
              onClick={() => {
                setSubscription(filter.key);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
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
        <EmptyState
          icon={Building2}
          title="No companies match"
          description="Try a different search or filter."
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
                    <EnumStatusText value={company.subscriptionStatus} />
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
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Appts</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.data.items.map((company) => (
                  <TableRow
                    key={company.id}
                    onClick={() => navigate(ADMIN_ROUTES.company(company.id))}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-ink-muted">
                      <span className="block">{company.ownerName ?? '—'}</span>
                      <span className="block text-caption text-ink-faint">
                        {company.ownerEmail ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {company.plan ? humanizeEnum(company.plan) : '—'}
                    </TableCell>
                    <TableCell>
                      <EnumStatusText value={company.subscriptionStatus} />
                    </TableCell>
                    <TableCell className="font-num">{company.callsToday}</TableCell>
                    <TableCell className="font-num">{company.leadsToday}</TableCell>
                    <TableCell className="font-num">{company.appointmentsToday}</TableCell>
                    <TableCell className="text-caption text-ink-faint">
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
  );
}
