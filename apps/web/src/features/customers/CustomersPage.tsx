import { useState } from 'react';
import { Users, Search, Plus } from 'lucide-react';
import { PropertyType } from '@rooferslabs/shared';
import { useCustomers, useSaveCustomer } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Customer } from '@/types/api';
import { formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const customers = useCustomers({ page, search: debouncedSearch || undefined });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has called or been added to your front office."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add customer
          </Button>
        }
      />

      <Card className="overflow-hidden">
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
              placeholder="Search name, phone, email, address…"
              className="focus-ring h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-form-input text-ink placeholder:text-ink-faint transition-colors duration-fast hover:border-line-strong"
              aria-label="Search customers"
            />
          </div>
        </div>

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
            icon={Users}
            title="No customers yet"
            description="Customers are created automatically from inbound calls, or add one manually."
            actionLabel="Add customer"
            onAction={() => setCreating(true)}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.data.items.map((customer) => (
                  <TableRow
                    key={customer.id}
                    onClick={() => setEditing(customer)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">
                      {customer.fullName ?? 'Unknown caller'}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      <span className="block">{formatPhone(customer.phone)}</span>
                      {customer.email && (
                        <span className="block text-caption text-ink-faint">
                          {customer.email}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate text-ink-muted md:table-cell">
                      {customer.propertyAddress ?? '—'}
                      <span className="block text-caption text-ink-faint">
                        {humanizeEnum(customer.propertyType)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EnumBadge value={customer.status} />
                    </TableCell>
                    <TableCell className="hidden text-caption text-ink-faint sm:table-cell">
                      {timeAgo(customer.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination pagination={customers.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CustomerModal
        open={creating || editing !== null}
        customer={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function CustomerModal({
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
          <p className="text-small text-emergency">{(save.error as Error).message}</p>
        )}
        <div className="flex justify-end gap-2">
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
