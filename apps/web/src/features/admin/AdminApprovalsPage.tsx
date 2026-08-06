import { useState } from 'react';
import { CompanyStatus } from '@rooferslabs/shared';
import { useAdminCompanies, useCompanyApproval, type ApprovalAction } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate, timeAgo } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { STATUS_ORDER, presentationFor } from './approvalStatus';
import { UserGroupIcon } from '@heroicons/react/24/outline';

/**
 * The tabs, in the order a founder works through them.
 *
 * "Pending" is not the default. Opening on a filtered view hides how many
 * accounts exist at all, and the summary cards above already draw the eye to
 * whatever is waiting — so the table opens on everything and the founder narrows
 * it deliberately.
 */
const FILTERS = [
  { key: undefined, label: 'All' },
  ...STATUS_ORDER.map((status) => ({
    key: status,
    label: presentationFor(status).label,
  })),
] as const;

/** One summary figure. Four across on a desktop, two up on a phone. */
function SummaryCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number | undefined;
  tone: 'warning' | 'success' | 'danger' | 'neutral' | 'brand';
  active: boolean;
  onClick: () => void;
}) {
  return (
    // A button, not a card: every one of these is also the filter for the thing
    // it counts, and "3 pending" is the most natural way to ask to see them.
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-ring flex flex-col items-start gap-1 border px-4 py-3.5 text-left transition-colors duration-fast ${
        active
          ? 'border-accent-border bg-accent-subtle'
          : 'border-line-subtle bg-surface-1 hover:bg-surface-2'
      }`}
    >
      <Badge tone={tone}>{label}</Badge>
      <span className="font-num text-h4 tabular-nums text-ink">{value ?? '—'}</span>
    </button>
  );
}

/**
 * Customer approvals — the founder's queue, and the only place on the platform
 * where an account is admitted, paused, or restored.
 *
 * "Customer" here means a tenant: a roofing company that has signed up. The API
 * calls the same thing a *company*, because inside a tenant "customer" already
 * means one of that roofing company's homeowners. The endpoints keep the domain
 * word; this screen uses the founder's.
 *
 * Every control on the page is a convenience over an authorization decision made
 * elsewhere. The rows a customer must never see, the buttons they must never
 * press, the statuses they must never write — all of it is refused by
 * `PlatformAdminGuard` on the API regardless of what any browser renders.
 */
export function AdminApprovalsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CompanyStatus | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const debounced = useDebouncedValue(search);

  const companies = useAdminCompanies({ page, search: debounced || undefined, status });
  const approval = useCompanyApproval();
  const counts = companies.data?.counts;

  const filter = (next: CompanyStatus | undefined) => {
    setStatus((current) => (current === next ? undefined : next));
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        className="mb-4"
        title="Customer approvals"
        description={
          counts
            ? `${counts[CompanyStatus.PENDING_APPROVAL]} awaiting a decision · ${counts.total} total.`
            : 'Approve, pause, and restore access for every customer on the platform.'
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATUS_ORDER.filter((s) => s !== CompanyStatus.ONBOARDING).map((s) => {
          const presentation = presentationFor(s);
          return (
            <SummaryCard
              key={s}
              label={presentation.summary}
              value={counts?.[s]}
              tone={presentation.tone}
              active={status === s}
              onClick={() => filter(s)}
            />
          );
        })}
        <SummaryCard
          label="Total customers"
          value={counts?.total}
          tone="brand"
          active={status === undefined}
          onClick={() => filter(undefined)}
        />
      </div>

      <Card className="overflow-hidden">
        <FilterBar>
          <SearchInput
            className="sm:max-w-sm sm:flex-1"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search company, email, phone…"
            aria-label="Search customers"
          />
          <div className="flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <Button
                key={f.label}
                size="sm"
                variant={status === f.key ? 'primary' : 'ghost'}
                onClick={() => {
                  setStatus(f.key);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </FilterBar>

        {companies.isLoading ? (
          <ListSkeleton />
        ) : companies.isError ? (
          <ErrorState
            title="Couldn’t load customers"
            message={(companies.error as Error).message}
            onRetry={() => void companies.refetch()}
          />
        ) : !companies.data?.items.length ? (
          <EmptyState
            icon={UserGroupIcon}
            title={search || status ? 'No customers match' : 'No customers yet'}
            description={
              search || status
                ? 'Try a different search term or clear the filter.'
                : 'Customers appear here as soon as they finish signing up.'
            }
          />
        ) : (
          <>
            {/* Phones get the stacked list — the table scrolls sideways, which
                is the wrong shape for a hand. The primary action rides on each
                row so the common case (accept a pending account) never needs
                the drawer at all. */}
            <ul className="divide-y divide-line-subtle border-t border-line-subtle lg:hidden">
              {companies.data.items.map((company) => {
                const presentation = presentationFor(company.status);
                return (
                  <li key={company.id} className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(company.id)}
                      className="focus-ring min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-body font-medium text-ink">
                        {company.name}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {company.ownerEmail ?? '—'}
                      </span>
                      <Badge tone={presentation.tone} className="mt-1.5">
                        {presentation.label}
                      </Badge>
                    </button>
                    {presentation.action && (
                      <Button
                        size="sm"
                        variant={presentation.action === 'pause' ? 'secondary' : 'primary'}
                        disabled={approval.isPending}
                        onClick={() =>
                          approval.mutate({
                            id: company.id,
                            action: presentation.action as ApprovalAction,
                          })
                        }
                      >
                        {presentation.actionLabel}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Last active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.data.items.map((company) => {
                    const presentation = presentationFor(company.status);
                    return (
                      <TableRow
                        key={company.id}
                        onClick={() => setOpenId(company.id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium text-ink">{company.name}</TableCell>
                        <TableCell className="text-ink-muted">{company.ownerName ?? '—'}</TableCell>
                        <TableCell className="text-ink-muted">
                          <span className="block truncate">{company.ownerEmail ?? '—'}</span>
                        </TableCell>
                        <TableCell className="text-caption text-ink-faint">
                          {company.createdAt ? formatDate(company.createdAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge tone={presentation.tone}>{presentation.label}</Badge>
                        </TableCell>
                        <TableCell className="text-caption text-ink-faint">
                          {company.approvedAt ? formatDate(company.approvedAt) : '—'}
                        </TableCell>
                        <TableCell className="text-caption text-ink-faint">
                          {company.lastActiveAt ? timeAgo(company.lastActiveAt) : '—'}
                        </TableCell>
                        {/* The row navigates; the buttons must not also do that,
                            hence `stopPropagation` on the cell rather than on
                            each control. */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setOpenId(company.id)}>
                              View details
                            </Button>
                            {presentation.action && (
                              <Button
                                size="sm"
                                variant={presentation.action === 'pause' ? 'secondary' : 'primary'}
                                disabled={approval.isPending}
                                onClick={() =>
                                  approval.mutate({
                                    id: company.id,
                                    action: presentation.action as ApprovalAction,
                                  })
                                }
                              >
                                {presentation.actionLabel}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination pagination={companies.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CustomerDetailDrawer companyId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
