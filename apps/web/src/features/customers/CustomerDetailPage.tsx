import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { useCustomer, useDeleteCustomer, useSaveCustomer } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import {
  cn,
  formatDateTime,
  formatDuration,
  formatPhone,
  humanizeEnum,
  timeAgo,
} from '@/lib/utils';
import type { Appointment, CustomerDetail } from '@/types/api';
import { buttonClass, Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import { IconTile } from '@/components/ui/IconTile';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ROUTES } from '@/auth/stages';
import { CustomerModal } from './CustomersPage';

/**
 * The customer profile — a read-only view of everything the front office knows
 * about one caller.
 *
 * Opening a customer used to drop straight into an edit form, which made every
 * glance an accidental edit waiting to happen. Editing is now one explicit
 * action among several at the bottom of the page.
 *
 * Laid out like the call detail page: back link, shared `PageHeader`, then
 * stacked cards. Single column at every breakpoint, so there is nothing to
 * scroll sideways.
 */
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = useCustomer(id);
  const navigate = useNavigate();
  const save = useSaveCustomer();
  const remove = useDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (customer.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Loading customer…" />
      </Card>
    );
  }
  if (customer.isError || !customer.data) {
    const notFound = customer.error instanceof ApiError && customer.error.status === 404;
    return (
      <Card>
        {notFound || !customer.data ? (
          <EmptyState
            icon={User}
            title="Customer not found"
            description="They may have been removed, or you may not have access to them."
          />
        ) : (
          <ErrorState
            title="Couldn’t load this customer"
            message={(customer.error as Error).message}
            onRetry={() => void customer.refetch()}
          />
        )}
      </Card>
    );
  }

  const data = customer.data;
  const name = data.fullName ?? 'Unknown caller';
  // Conversations arrive newest first, so the ends of the list are the ends of
  // the relationship. Defaulted because an ECS rollout drains the old API tasks
  // gradually: for those few minutes a response can still come back without
  // these relations, and a profile should render without them rather than throw.
  const contacts = data.conversations ?? [];
  const appointments = data.appointments ?? [];
  const lastContact = contacts[0]?.createdAt ?? null;
  const firstContact = contacts[contacts.length - 1]?.createdAt ?? null;

  // Starring is a plain field update, so it goes through the same save
  // mutation as the edit form — and its `customers` invalidation refreshes both
  // this profile and the list behind it.
  const toggleFavorite = () => save.mutate({ id: data.id, isFavorite: !data.isFavorite });

  return (
    <div>
      <Link
        to={ROUTES.customers}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to customers
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <IconTile icon={User} tone="brand" size="lg" />
            {name}
            <EnumStatusText value={data.status} />
            {data.isFavorite && (
              <StatusText tone="brand" className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent" aria-hidden />
                Favorite
              </StatusText>
            )}
          </span>
        }
        description={
          <span className="text-body text-ink-muted">
            <span className="font-num">{formatPhone(data.phone)}</span>
            {data.propertyAddress && ` · ${data.propertyAddress}`}
          </span>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line-subtle">
              <DetailRow label="Full name" value={data.fullName ?? '—'} />
              <DetailRow label="Phone" value={formatPhone(data.phone)} />
              <DetailRow label="Email" value={data.email ?? '—'} />
              <DetailRow label="Property address" value={data.propertyAddress ?? '—'} />
              <DetailRow label="Property type" value={humanizeEnum(data.propertyType)} />
              <DetailRow label="Status" value={humanizeEnum(data.status)} />
              <DetailRow label="Customer since" value={formatDateTime(data.createdAt)} />
              <DetailRow
                label="First contact"
                value={firstContact ? formatDateTime(firstContact) : '—'}
              />
              <DetailRow
                label="Last contact"
                value={lastContact ? formatDateTime(lastContact) : '—'}
              />
              {data.notes && <DetailRow label="Notes" value={data.notes} />}
            </dl>
          </CardContent>
        </Card>

        <RecentActivity conversations={contacts} />
        <RecentCalls conversations={contacts} />
        <Appointments appointments={appointments} />

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent>
            {/* One action carries the weight — calling back is what this page
                exists for — and the rest step down to icons with labels. */}
            {data.phone ? (
              <a href={`tel:${data.phone}`} className={buttonClass('primary', 'lg', 'w-full')}>
                <Phone className="h-4 w-4" aria-hidden />
                Call customer
              </a>
            ) : (
              <Button size="lg" className="w-full" disabled>
                <Phone className="h-4 w-4" aria-hidden />
                Call customer
              </Button>
            )}

            <div className="mt-4 grid grid-cols-4 gap-2">
              <IconAction
                icon={Star}
                label={data.isFavorite ? 'Favorited' : 'Favorite'}
                onClick={toggleFavorite}
                active={data.isFavorite}
                pressed={data.isFavorite}
              />
              <IconAction icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
              {/* Outbound SMS is not wired up yet. Shown disabled rather than
                  hidden so the action is discoverable the day it lands, and
                  nobody waits for a message that never sends. */}
              <IconAction
                icon={MessageSquare}
                label="SMS"
                disabled
                title="Text messaging is coming soon"
              />
              <IconAction
                icon={Trash2}
                label="Delete"
                onClick={() => setConfirmingDelete(true)}
                tone="danger"
              />
            </div>
            {save.isError && (
              <p className="mt-3 text-small text-emergency" role="alert">
                {(save.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomerModal open={editing} customer={data} onClose={() => setEditing(false)} />

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this customer?"
      >
        <p className="text-body text-ink-muted">
          {name} will be archived and removed from your customer list. Their calls and appointments
          are kept.
        </p>
        {remove.isError && (
          <p className="mt-3 text-small text-emergency" role="alert">
            {(remove.error as Error).message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={remove.isPending}
            onClick={() => remove.mutate(data.id, { onSuccess: () => navigate(ROUTES.customers) })}
          >
            Delete customer
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * A secondary action: icon in a bordered circle, label underneath.
 *
 * The whole control is the tap target, not just the circle, so all four have
 * the same touch area and sit on one four-column grid — equal widths and equal
 * gaps without any of them declaring a size.
 *
 * `danger` outlines rather than fills. A filled red button belongs to a
 * confirmation step, not to a row of options someone is still reading.
 */
function IconAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  tone = 'neutral',
  active = false,
  pressed,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  tone?: 'neutral' | 'danger';
  /** Filled treatment — the favourite, once it is one. */
  active?: boolean;
  pressed?: boolean;
}) {
  const danger = tone === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
      className={cn(
        'focus-ring group flex flex-col items-center gap-2 px-1 py-2',
        'transition-colors duration-fast ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-40',
        !disabled && 'hover:bg-surface-2',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border',
          'transition-colors duration-fast ease-standard',
          active
            ? 'border-accent bg-accent text-ink-on-brand'
            : danger
              ? 'border-emergency-border bg-surface text-emergency'
              : 'border-line bg-surface text-ink-muted',
          !disabled && !active && !danger && 'group-hover:border-line-strong group-hover:text-ink',
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 transition-[fill,color] duration-fast ease-standard',
            active && 'fill-ink-on-brand',
          )}
          aria-hidden
        />
      </span>
      <span
        className={cn(
          'text-caption font-medium',
          danger ? 'text-emergency' : active ? 'text-accent' : 'text-ink-muted',
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Newest-first timeline of what the AI did on this customer's calls. */
function RecentActivity({ conversations }: { conversations: CustomerDetail['conversations'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      {!conversations.length ? (
        <CardContent>
          <p className="text-small text-ink-muted">No activity recorded yet.</p>
        </CardContent>
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {conversations.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-6 py-4">
              <IconTile
                icon={entry.isEmergency ? PhoneCall : Phone}
                tone={entry.isEmergency ? 'emergency' : 'brand'}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-medium text-ink">
                    {entry.outcome ? humanizeEnum(entry.outcome) : 'Call handled'}
                  </span>
                  <EnumStatusText value={entry.intent} />
                </div>
                <p className="font-num mt-0.5 text-caption text-ink-faint">
                  {formatDateTime(entry.createdAt)}
                </p>
                {entry.summary && (
                  <p className="mt-1 line-clamp-2 text-small text-ink-muted">{entry.summary}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The same call rows as elsewhere: when, how long, how it ended. */
function RecentCalls({ conversations }: { conversations: CustomerDetail['conversations'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent calls</CardTitle>
      </CardHeader>
      {!conversations.length ? (
        <CardContent>
          <p className="text-small text-ink-muted">No calls with this customer yet.</p>
        </CardContent>
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {conversations.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`${ROUTES.conversations}/${entry.id}`}
                className="focus-ring flex items-center gap-3 px-6 py-4 transition-colors duration-fast hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-num block truncate text-body text-ink">
                    {formatDateTime(entry.call?.createdAt ?? entry.createdAt)}
                  </span>
                  <span className="font-num mt-0.5 block text-small text-ink-muted">
                    {formatDuration(entry.call?.durationSeconds)}
                  </span>
                </span>
                <EnumStatusText value={entry.outcome} className="shrink-0 text-right" />
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Appointments({ appointments }: { appointments: Appointment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments</CardTitle>
      </CardHeader>
      {!appointments.length ? (
        <CardContent>
          <p className="text-small text-ink-muted">No appointments for this customer.</p>
        </CardContent>
      ) : (
        <>
          <ul className="divide-y divide-line-subtle border-t border-line-subtle">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="flex items-start gap-3 px-6 py-4">
                <IconTile icon={CalendarClock} tone="brand" size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-ink">
                    {appointment.serviceRequested ?? 'Appointment'}
                  </span>
                  <span className="font-num mt-0.5 block text-small text-ink-muted">
                    {appointment.preferredDate
                      ? formatDateTime(appointment.preferredDate)
                      : `Requested ${timeAgo(appointment.createdAt)}`}
                    {appointment.preferredTimeWindow && ` · ${appointment.preferredTimeWindow}`}
                  </span>
                </div>
                <EnumStatusText value={appointment.status} className="shrink-0 text-right" />
              </li>
            ))}
          </ul>
          <CardContent>
            <Link
              to={ROUTES.appointments}
              className="focus-ring inline-flex items-center gap-1 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
            >
              Manage in Appointments
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardContent>
        </>
      )}
    </Card>
  );
}
