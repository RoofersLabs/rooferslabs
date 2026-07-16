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
import { useDashboard, usePhoneNumber } from '@/hooks/queries';
import { formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/Badge';
import { LoadingBlock } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export function DashboardPage() {
  const dashboard = useDashboard();
  const phone = usePhoneNumber();

  const metrics = dashboard.data?.metrics;
  const needsPhoneSetup = !phone.isLoading && !phone.data;
  const needsForwarding = Boolean(phone.data && !phone.data.forwardingVerifiedAt);

  return (
    <div>
      <PageHeader title="Dashboard" description="Today’s activity across your front office." />

      {(needsPhoneSetup || needsForwarding) && (
        <Link
          to="/settings/phone"
          className="focus-ring mb-6 flex items-center gap-4 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 transition-colors hover:border-brand-300"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700">
            <PhoneForwarded className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-brand-900">
              {needsPhoneSetup
                ? 'Finish setup: connect your AI phone line'
                : 'Almost there: forward your business number'}
            </span>
            <span className="block text-xs text-brand-700">
              {needsPhoneSetup
                ? 'Your AI receptionist needs a phone number before it can answer calls.'
                : `Forward your business line to ${formatPhone(phone.data?.phoneNumber)} so the AI starts answering.`}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
        </Link>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={Phone} label="Calls today" value={metrics?.todaysCalls} tone="brand" />
        <MetricCard icon={Flame} label="Leads today" value={metrics?.todaysLeads} tone="emerald" />
        <MetricCard
          icon={ShieldAlert}
          label="Emergencies today"
          value={metrics?.todaysEmergencies}
          tone="red"
        />
        <MetricCard
          icon={CalendarClock}
          label="Pending appointments"
          value={metrics?.pendingAppointments}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Recent conversations */}
        <section className="card" aria-label="Recent conversations">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent conversations</h2>
            <Link
              to="/calls"
              className="focus-ring rounded text-xs font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          </header>
          {dashboard.isLoading ? (
            <LoadingBlock />
          ) : !dashboard.data?.recentConversations.length ? (
            <EmptyState
              icon={Phone}
              title="No conversations yet"
              description="Once your number is forwarded, every answered call will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dashboard.data.recentConversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    to={`/conversations/${conversation.id}`}
                    className="focus-ring flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50"
                  >
                    <span
                      className={
                        conversation.isEmergency
                          ? 'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100'
                          : 'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50'
                      }
                    >
                      {conversation.isEmergency ? (
                        <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden />
                      ) : (
                        <Phone className="h-4 w-4 text-brand-700" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {conversation.customer?.fullName ??
                            formatPhone(conversation.call?.fromNumber)}
                        </span>
                        <EnumBadge value={conversation.outcome} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {conversation.summary ?? 'Processing summary…'}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
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
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Appointment requests</h2>
            <Link
              to="/appointments"
              className="focus-ring rounded text-xs font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          </header>
          {dashboard.isLoading ? (
            <LoadingBlock />
          ) : !dashboard.data?.upcomingAppointments.length ? (
            <EmptyState
              icon={CalendarClock}
              title="No appointment requests"
              description="When callers request estimates or inspections, they’ll show up here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {dashboard.data.upcomingAppointments.map((appointment) => (
                <li key={appointment.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {appointment.customer?.fullName ?? 'Customer'}
                    </span>
                    <EnumBadge value={appointment.priority} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
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

const toneStyles = {
  brand: 'bg-brand-50 text-brand-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
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
        <span className="block text-2xl font-bold text-slate-900">{value ?? '—'}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}
