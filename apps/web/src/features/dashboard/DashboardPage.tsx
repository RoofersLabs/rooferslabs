import { Link } from 'react-router-dom';
import {
  Phone,
  Flame,
  CalendarClock,
  Users,
  ShieldAlert,
  ArrowRight,
  PhoneForwarded,
} from 'lucide-react';
import { useDashboard, usePhoneNumber, useReceptionistStatus } from '@/hooks/queries';
import { cn, formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/Badge';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';

export function DashboardPage() {
  const dashboard = useDashboard();
  const phone = usePhoneNumber();
  const receptionist = useReceptionistStatus();

  if (dashboard.isError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Today’s activity across your front office." />
        <div className="card">
          <ErrorState
            title="Couldn’t load your dashboard"
            message={(dashboard.error as Error).message}
            onRetry={() => void dashboard.refetch()}
          />
        </div>
      </div>
    );
  }

  const metrics = dashboard.data?.metrics;
  const needsPhoneSetup = !phone.isLoading && !phone.data;
  const needsForwarding = Boolean(phone.data && !phone.data.forwardingVerifiedAt);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today’s activity across your front office."
        actions={
          receptionist.data ? (
            <div className="flex flex-wrap gap-2">
              <StatusChip
                good={receptionist.data.enabled}
                goodLabel="AI Receptionist Active"
                badLabel="AI Receptionist Disabled"
              />
              <StatusChip
                good={receptionist.data.forwardingVerified}
                goodLabel="Forwarding Verified"
                badLabel="Forwarding Required"
              />
            </div>
          ) : undefined
        }
      />

      {(needsPhoneSetup || needsForwarding) && (
        <Link
          to="/settings/phone"
          className="focus-ring mb-6 flex items-center gap-4 rounded-xl border border-accent-border bg-accent-subtle px-5 py-4 transition-colors duration-fast hover:border-accent"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-ink-on-brand">
            <PhoneForwarded className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-ink">
              {needsPhoneSetup
                ? 'Finish setup: connect your AI phone line'
                : 'Almost there: forward your business number'}
            </span>
            <span className="block text-small text-ink-muted">
              {needsPhoneSetup
                ? 'Your AI receptionist needs a phone number before it can answer calls.'
                : `Forward your business line to ${formatPhone(phone.data?.phoneNumber)} so the AI starts answering.`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        </Link>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Phone} label="Calls today" value={metrics?.todaysCalls} tone="brand" />
        <MetricCard icon={Flame} label="Leads today" value={metrics?.todaysLeads} tone="success" />
        <MetricCard
          icon={ShieldAlert}
          label="Emergencies today"
          value={metrics?.todaysEmergencies}
          tone="emergency"
        />
        <MetricCard
          icon={CalendarClock}
          label="Pending appointments"
          value={metrics?.pendingAppointments}
          tone="warning"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent conversations */}
        <section className="card" aria-label="Recent conversations">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Recent conversations</h2>
            <Link
              to="/calls"
              className="focus-ring rounded text-small font-medium text-accent hover:underline"
            >
              View all
            </Link>
          </header>
          {dashboard.isLoading ? (
            <ListSkeleton rows={4} />
          ) : !dashboard.data?.recentConversations.length ? (
            <EmptyState
              icon={Phone}
              title="No conversations yet"
              description="Once your number is forwarded, every answered call will appear here."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {dashboard.data.recentConversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    to={`/conversations/${conversation.id}`}
                    className="focus-ring flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2"
                  >
                    <span
                      className={
                        conversation.isEmergency
                          ? 'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emergency-subtle'
                          : 'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle'
                      }
                    >
                      {conversation.isEmergency ? (
                        <ShieldAlert className="h-4 w-4 text-emergency" aria-hidden />
                      ) : (
                        <Phone className="h-4 w-4 text-accent" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">
                          {conversation.customer?.fullName ??
                            formatPhone(conversation.call?.fromNumber)}
                        </span>
                        <EnumBadge value={conversation.outcome} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {conversation.summary ?? 'Processing summary…'}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-faint">
                        {timeAgo(conversation.createdAt)} ·{' '}
                        {formatDuration(conversation.call?.durationSeconds)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Appointment requests */}
        <section className="card" aria-label="Appointment requests">
          <header className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Appointment requests</h2>
            <Link
              to="/appointments"
              className="focus-ring rounded text-small font-medium text-accent hover:underline"
            >
              View all
            </Link>
          </header>
          {dashboard.isLoading ? (
            <ListSkeleton rows={4} />
          ) : !dashboard.data?.upcomingAppointments.length ? (
            <EmptyState
              icon={CalendarClock}
              title="No appointment requests"
              description="When callers request estimates or inspections, they’ll show up here."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {dashboard.data.upcomingAppointments.map((appointment) => (
                <li key={appointment.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {appointment.customer?.fullName ?? 'Customer'}
                    </span>
                    <EnumBadge value={appointment.priority} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {appointment.serviceRequested ?? 'Service visit'} ·{' '}
                    {appointment.preferredTimeWindow ?? humanizeEnum(appointment.status)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Secondary stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          icon={Phone}
          label="Calls this week"
          value={metrics?.weeklyCalls}
          tone="slate"
        />
        <MetricCard
          icon={Users}
          label="Total customers"
          value={metrics?.totalCustomers}
          tone="slate"
        />
        <MetricCard
          icon={CalendarClock}
          label="Unread notifications"
          value={metrics?.unreadNotifications}
          tone="slate"
        />
      </div>
    </div>
  );
}

/** Compact receptionist/forwarding status chip linking to Phone Setup. */
function StatusChip({
  good,
  goodLabel,
  badLabel,
}: {
  good: boolean;
  goodLabel: string;
  badLabel: string;
}) {
  return (
    <Link
      to="/settings/phone"
      className={cn(
        'focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium',
        good
          ? 'border-success-border bg-success-subtle text-success'
          : 'border-warning-border bg-warning-subtle text-warning',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', good ? 'bg-success' : 'bg-warning')}
        aria-hidden
      />
      {good ? goodLabel : badLabel}
    </Link>
  );
}

const toneStyles = {
  brand: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  emergency: 'bg-emergency-subtle text-emergency',
  warning: 'bg-warning-subtle text-warning',
  slate: 'bg-surface-3 text-ink-muted',
} as const;

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Phone;
  label: string;
  value: number | undefined;
  tone: keyof typeof toneStyles;
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span>
        {value === undefined ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <span className="font-num block text-2xl font-bold text-ink">{value}</span>
        )}
        <span className="block text-caption text-ink-muted">{label}</span>
      </span>
    </div>
  );
}
