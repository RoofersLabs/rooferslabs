import { useState } from 'react';
import { cn, formatPhone, humanizeEnum } from '@/lib/utils';
import { REFINED_BUTTON } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { EnumStatusText } from '@/components/ui/StatusText';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { customers } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';
import { useWide } from '../formFactor';

/**
 * The Customers page, matching `features/customers/CustomersPage`: a table on a
 * tablet, and the same records as a stacked list on a phone — the page does not
 * shrink its table onto a handset, it renders a different thing.
 */
export function CustomersView({ onOpen }: { onOpen?: (id: string) => void }) {
  const wide = useWide();
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? customers.filter((customer) =>
        `${customer.name} ${customer.phone} ${customer.email} ${customer.address}`
          .toLowerCase()
          .includes(needle),
      )
    : customers;

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Customers"
          description="Everyone who has called or been added to your front office."
          actions={
            <Button className={REFINED_BUTTON} size="sm">
              <PlusIcon aria-hidden />
              Add customer
            </Button>
          }
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          <FilterBar>
            <SearchInput
              className="sm:max-w-sm sm:flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or email…"
              aria-label="Search customers"
            />
          </FilterBar>

          {!visible.length ? (
            <p className="px-6 py-10 text-center text-body text-ink-muted">
              No customers match “{search.trim()}”.
            </p>
          ) : (
            <>
              {/* Which layout appears is decided by the device, not by the
                  visitor's window: a handset and an iPad in portrait get the
                  card list, a landscape iPad gets the table, whatever the
                  browser around the device happens to be.

                  The application splits these at `md`. One stop later here,
                  because the table's five columns need the room the
                  application has at `md` and the replica does not: the same
                  device also has a 256px sidebar beside it, and the property
                  column went out through the card's right edge. */}
              {!wide && (
                <StaggerList className="divide-y divide-line-subtle border-t border-line-subtle">
                  {visible.map((customer) => (
                    <StaggerRow key={customer.id}>
                      <button
                        type="button"
                        onClick={() => onOpen?.(customer.id)}
                        data-demo-target={`row:${customer.id}`}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-fast hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-body font-medium text-ink">
                              {customer.name}
                            </span>
                            {customer.favorite && (
                              <StarIcon
                                className="h-3.5 w-3.5 shrink-0 fill-accent text-accent"
                                aria-label="Favorite"
                              />
                            )}
                          </span>
                          <span className="font-num mt-0.5 block truncate text-small text-ink-muted">
                            {formatPhone(customer.phone)}
                          </span>
                          <span className="mt-0.5 block truncate text-caption text-ink-faint">
                            {customer.address}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <EnumStatusText value={customer.status} className="shrink-0" />
                          <ChevronRightIcon className="h-4 w-4 text-ink-faint" aria-hidden />
                        </span>
                      </button>
                    </StaggerRow>
                  ))}
                </StaggerList>
              )}

              <div className={cn(!wide && 'hidden')}>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => onOpen?.(customer.id)}
                        data-demo-target={`row:${customer.id}`}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {customer.name}
                            {customer.favorite && (
                              <StarIcon
                                className="h-3.5 w-3.5 shrink-0 fill-accent text-accent"
                                aria-label="Favorite"
                              />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          <span className="font-num block">{formatPhone(customer.phone)}</span>
                          <span className="block text-caption text-ink-faint">
                            {customer.email}
                          </span>
                        </TableCell>
                        {/* 12rem rather than the product's 16rem: at 960px of
                            content the five columns wanted 966, so the table
                            grew its own 6px scrollbar. The cell truncates
                            either way. */}
                        <TableCell className="max-w-[12rem] truncate text-ink-muted">
                          {customer.address}
                          <span className="block text-caption text-ink-faint">
                            {humanizeEnum(customer.propertyType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <EnumStatusText value={customer.status} />
                        </TableCell>
                        <TableCell className="text-caption text-ink-faint">
                          {customer.added}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <Pagination
            pagination={{
              page: 1,
              limit: 20,
              totalRecords: 412,
              totalPages: 21,
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
