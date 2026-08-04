import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PropertyType } from '@rooferslabs/shared';
import { useCustomers, useSaveCustomer } from '@/hooks/queries';
import { ROUTES } from '@/auth/stages';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Customer } from '@/types/api';
import { formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumStatusText } from '@/components/ui/StatusText';
import { REFINED_BUTTON } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
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
import { ChevronRightIcon, PlusIcon, UsersIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [creating, setCreating] = useState(false);
  const customers = useCustomers({ page, search: debouncedSearch || undefined });
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has called or been added to your front office."
        actions={
          <Button className={REFINED_BUTTON} onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Add customer
          </Button>
        }
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
            placeholder="Search name, phone, email, address…"
            aria-label="Search customers"
          />
        </FilterBar>

        {customers.isLoading ? (
          <ListSkeleton />
        ) : customers.isError ? (
          <ErrorState
            title="Couldn’t load customers"
            message={(customers.error as Error).message}
            onRetry={() => void customers.refetch()}
          />
        ) : !customers.data?.items.length ? (
          <EmptyState
            icon={UsersIcon}
            title="No customers yet"
            description="Customers are created automatically from inbound calls, or add one manually."
            actionLabel="Add customer"
            actionClassName={REFINED_BUTTON}
            onAction={() => setCreating(true)}
          />
        ) : (
          <>
            {/* Below `md` the table is not rendered at all. Its container is
                `overflow-x-auto`, which is what made the list scroll sideways
                on a phone — hiding the columns would have kept the scroll. */}
            <ul className="divide-y divide-line-subtle border-t border-line-subtle md:hidden">
              {customers.data.items.map((customer) => (
                <li key={customer.id}>
                  <Link
                    to={`${ROUTES.customers}/${customer.id}`}
                    className="focus-ring flex items-center gap-3 px-4 py-3.5 transition-colors duration-fast hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-body font-medium text-ink">
                          {customer.fullName ?? 'Unknown caller'}
                        </span>
                        {customer.isFavorite && (
                          <StarIcon
                            className="h-3.5 w-3.5 shrink-0 fill-accent text-accent"
                            aria-label="Favorite"
                          />
                        )}
                      </span>
                      <span className="font-num mt-0.5 block truncate text-small text-ink-muted">
                        {formatPhone(customer.phone)}
                      </span>
                      {/* Always rendered, so every row is the same height —
                          the address when there is one, otherwise when they
                          were added. */}
                      <span className="mt-0.5 block truncate text-caption text-ink-faint">
                        {customer.propertyAddress ?? `Added ${timeAgo(customer.createdAt)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <EnumStatusText value={customer.status} className="shrink-0" />
                      <ChevronRightIcon className="h-4 w-4 text-ink-faint" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:block">
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
                  {customers.data.items.map((customer) => (
                    <TableRow
                      key={customer.id}
                      onClick={() => navigate(`${ROUTES.customers}/${customer.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-1.5">
                          {customer.fullName ?? 'Unknown caller'}
                          {customer.isFavorite && (
                            <StarIcon
                              className="h-3.5 w-3.5 shrink-0 fill-accent text-accent"
                              aria-label="Favorite"
                            />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-ink-muted">
                        <span className="block">{formatPhone(customer.phone)}</span>
                        {customer.email && (
                          <span className="block text-caption text-ink-faint">
                            {customer.email}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate text-ink-muted">
                        {customer.propertyAddress ?? '—'}
                        <span className="block text-caption text-ink-faint">
                          {humanizeEnum(customer.propertyType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <EnumStatusText value={customer.status} />
                      </TableCell>
                      <TableCell className="hidden text-caption text-ink-faint lg:table-cell">
                        {timeAgo(customer.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination pagination={customers.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      {/* Add only. Editing an existing customer now happens from their profile,
          behind an explicit action, so opening a customer is a read. */}
      <CustomerModal open={creating} customer={null} onClose={() => setCreating(false)} />
    </div>
  );
}

export function CustomerModal({
  open,
  customer,
  onClose,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}) {
  const save = useSaveCustomer();
  const [form, setForm] = useState<Partial<Customer>>({});

  // Reset local form state when the target customer changes.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = customer?.id ?? 'new';
  if (key !== lastKey) {
    setLastKey(key);
    setForm(customer ?? {});
  }

  const set =
    (field: keyof Customer) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: customer?.id,
        fullName: form.fullName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        propertyAddress: form.propertyAddress || undefined,
        propertyType: form.propertyType || undefined,
        notes: form.notes || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? 'Edit customer' : 'Add customer'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Full name" value={form.fullName ?? ''} onChange={set('fullName')} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone ?? ''} onChange={set('phone')} />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={set('email')} />
        </div>
        <Input
          label="Property address"
          value={form.propertyAddress ?? ''}
          onChange={set('propertyAddress')}
        />
        <Select
          label="Property type"
          value={form.propertyType ?? PropertyType.UNKNOWN}
          onChange={set('propertyType')}
        >
          {Object.values(PropertyType).map((type) => (
            <option key={type} value={type}>
              {humanizeEnum(type)}
            </option>
          ))}
        </Select>
        <Textarea label="Notes" rows={3} value={form.notes ?? ''} onChange={set('notes')} />
        {save.isError && (
          <p className="text-small text-emergency" role="alert">
            {(save.error as Error).message}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
