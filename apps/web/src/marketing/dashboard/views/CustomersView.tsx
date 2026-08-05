import { useState } from 'react';
import { formatPhone, humanizeEnum } from '@/lib/utils';
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

/**
 * The Customers page, matching `features/customers/CustomersPage`: a table from
 * `md` up, and the same records as a stacked list below it — the page does not
 * shrink its table onto a phone, it renders a different thing.
 */
export function CustomersView() {
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
              {/* The card list runs to `lg`, not to `md` as it does in the
                  application. The breakpoint that matters is the width the
                  *table* gets, and the preview always sits inside a window
                  narrower than the viewport reporting the breakpoint — at a
                  768px viewport this window is 704px wide and the app's five
                  columns overhang it by 116px. Switching one step later gives
                  the table roughly the same room it has in the product at its
                  own `md`, so the visitor sees the layout they would get, not a
                  table jammed into a frame. */}
              <StaggerList className="divide-y divide-line-subtle border-t border-line-subtle lg:hidden">
                {visible.map((customer) => (
                  <StaggerRow key={customer.id}>
                    <div className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-2">
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
                    </div>
                  </StaggerRow>
                ))}
              </StaggerList>

              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer">
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
                        <TableCell className="hidden text-caption text-ink-faint lg:table-cell">
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
