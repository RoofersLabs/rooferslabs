import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Trash2, Phone, ShieldAlert } from 'lucide-react';
import { useAddCompanyNote, useAdminCompany, useDeleteCompanyNote } from '@/hooks/queries';
import { formatDateTime, formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { EnumStatusText } from '@/components/ui/StatusText';
import { IconTile } from '@/components/ui/IconTile';
import { Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ROUTES } from '@/auth/stages';
import { ADMIN_ROUTES } from './routes';

/**
 * One tenant's operational picture: who they are, what the AI has done for
 * them, and what staff have written down about them.
 *
 * Read-only over their data. The portal exists to understand an account, not to
 * operate it — the only thing written here is an internal note.
 */
export function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useAdminCompany(id);
  const addNote = useAddCompanyNote(id ?? '');
  const deleteNote = useDeleteCompanyNote(id ?? '');
  const [note, setNote] = useState('');

  if (detail.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Loading company…" />
      </Card>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Card>
        {detail.isError ? (
          <ErrorState
            title="Couldn’t load this company"
            message={(detail.error as Error).message}
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Company not found"
            description="It may have been removed."
          />
        )}
      </Card>
    );
  }

  const { company, usage, recentCalls, recentCustomers, recentAppointments, notes } = detail.data;

  return (
    <div>
      <Link
        to={ADMIN_ROUTES.companies}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to companies
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <IconTile icon={Building2} tone="brand" size="lg" />
            {company.name}
            <EnumStatusText value={company.status} />
          </span>
        }
        description={
          <span className="text-body text-ink-muted">
            {company.ownerEmail ?? '—'}
            {company.city && ` · ${company.city}, ${company.state ?? ''}`}
          </span>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line-subtle">
                <DetailRow label="Owner" value={company.ownerName ?? '—'} />
                <DetailRow label="Email" value={company.ownerEmail ?? company.email} />
                <DetailRow label="Phone" value={formatPhone(company.phone)} />
                <DetailRow
                  label="AI number"
                  value={
                    company.phoneNumbers[0]?.phoneNumber
                      ? formatPhone(company.phoneNumbers[0].phoneNumber)
                      : '—'
                  }
                />
                <DetailRow
                  label="Subscription"
                  value={
                    company.subscription
                      ? `${humanizeEnum(company.subscription.status)}${company.subscription.plan ? ` · ${humanizeEnum(company.subscription.plan)}` : ''}`
                      : 'None'
                  }
                />
                <DetailRow
                  label="Receptionist"
                  value={company.receptionistEnabled ? 'Enabled' : 'Disabled'}
                />
                <DetailRow label="Timezone" value={company.timezone} />
                <DetailRow label="Signed up" value={formatDateTime(company.createdAt)} />
                <DetailRow
                  label="Last active"
                  value={company.lastActiveAt ? timeAgo(company.lastActiveAt) : '—'}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line-subtle">
                <DetailRow label="Total calls" value={String(usage.totalCalls)} />
                <DetailRow label="Total leads" value={String(usage.totalLeads)} />
                <DetailRow label="Appointments" value={String(usage.totalAppointments)} />
                <DetailRow label="Emergency calls" value={String(usage.emergencyCalls)} />
                <DetailRow label="Customers" value={String(usage.totalCustomers)} />
                <DetailRow label="Resolution rate" value={`${usage.resolutionRate}%`} />
                <DetailRow
                  label="Avg. call length"
                  value={formatDuration(usage.averageCallSeconds)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card as="section" className="overflow-hidden">
          <CardHeader>
            <CardTitle as="h2">Recent calls</CardTitle>
          </CardHeader>
          {!recentCalls.length ? (
            <CardContent>
              <p className="text-small text-ink-muted">No calls yet.</p>
            </CardContent>
          ) : (
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {recentCalls.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    to={`${ROUTES.conversations}/${conversation.id}`}
                    className="focus-ring flex items-center gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2"
                  >
                    <IconTile
                      icon={conversation.isEmergency ? ShieldAlert : Phone}
                      tone={conversation.isEmergency ? 'emergency' : 'brand'}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {conversation.customer?.fullName ??
                          formatPhone(conversation.call?.fromNumber)}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {conversation.summary ?? 'No summary'}
                      </span>
                    </span>
                    <span className="flex w-28 shrink-0 flex-col items-end text-right sm:w-36">
                      <EnumStatusText
                        value={conversation.outcome}
                        className="max-w-full truncate"
                      />
                      <span className="mt-1 text-small text-ink-muted">
                        {timeAgo(conversation.createdAt)}
                      </span>
                      <span className="font-num mt-0.5 text-caption text-ink-faint">
                        {formatDuration(conversation.call?.durationSeconds)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card as="section" className="overflow-hidden">
            <CardHeader>
              <CardTitle as="h2">Customers</CardTitle>
            </CardHeader>
            {!recentCustomers.length ? (
              <CardContent>
                <p className="text-small text-ink-muted">No customers yet.</p>
              </CardContent>
            ) : (
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {recentCustomers.map((customer) => (
                  <li key={customer.id} className="flex items-center gap-3 px-6 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {customer.fullName ?? 'Unknown caller'}
                      </span>
                      <span className="font-num mt-0.5 block truncate text-small text-ink-muted">
                        {formatPhone(customer.phone)}
                      </span>
                    </span>
                    <EnumStatusText value={customer.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card as="section" className="overflow-hidden">
            <CardHeader>
              <CardTitle as="h2">Appointments</CardTitle>
            </CardHeader>
            {!recentAppointments.length ? (
              <CardContent>
                <p className="text-small text-ink-muted">No appointments yet.</p>
              </CardContent>
            ) : (
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {recentAppointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-center gap-3 px-6 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {appointment.serviceRequested ?? 'Appointment'}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {appointment.customer?.fullName ?? '—'}
                      </span>
                    </span>
                    <EnumStatusText value={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card as="section">
          <CardHeader>
            <CardTitle as="h2">Internal notes</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Staff-only, and stored in a table no customer endpoint reads. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                addNote.mutate(note.trim(), { onSuccess: () => setNote('') });
              }}
              className="space-y-3"
            >
              <Textarea
                label="Add a note"
                hint="Visible only inside the admin portal."
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" loading={addNote.isPending} disabled={!note.trim()}>
                  Add note
                </Button>
              </div>
            </form>

            {notes.length > 0 && (
              <ul className="mt-5 space-y-3 border-t border-line-subtle pt-5">
                {notes.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-small text-ink">{entry.body}</p>
                      <p className="mt-0.5 text-caption text-ink-faint">
                        {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete note"
                      onClick={() => deleteNote.mutate(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
