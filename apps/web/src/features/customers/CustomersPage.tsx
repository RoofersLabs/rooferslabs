import { useState } from 'react';
import { Users, Search, Plus } from 'lucide-react';
import { PropertyType } from '@rooferslabs/shared';
import { useCustomers, useSaveCustomer } from '@/hooks/queries';
import type { Customer } from '@/types/api';
import { formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingBlock } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const customers = useCustomers({ page, search: search || undefined });

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

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
              className="focus-ring h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm"
              aria-label="Search customers"
            />
          </div>
        </div>

        {customers.isLoading ? (
          <LoadingBlock />
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">Property</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="hidden px-5 py-3 font-medium sm:table-cell">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.data.items.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => setEditing(customer)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {customer.fullName ?? 'Unknown caller'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        <span className="block">{formatPhone(customer.phone)}</span>
                        {customer.email && (
                          <span className="block text-xs text-slate-400">{customer.email}</span>
                        )}
                      </td>
                      <td className="hidden max-w-[16rem] truncate px-5 py-3.5 text-slate-600 md:table-cell">
                        {customer.propertyAddress ?? '—'}
                        <span className="block text-xs text-slate-400">
                          {humanizeEnum(customer.propertyType)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <EnumBadge value={customer.status} />
                      </td>
                      <td className="hidden px-5 py-3.5 text-xs text-slate-400 sm:table-cell">
                        {timeAgo(customer.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={customers.data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>

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
        {save.isError && <p className="text-sm text-red-600">{(save.error as Error).message}</p>}
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
