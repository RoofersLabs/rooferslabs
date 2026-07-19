import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PhoneForwarded } from 'lucide-react';
import { useDashboard, usePhoneNumber, useReceptionistStatus } from '@/hooks/queries';
import { useSessionStore } from '@/state/session.store';
import { formatPhone } from '@/lib/utils';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardHeader } from './components/DashboardHeader';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { RecentCalls } from './components/RecentCalls';
import { AppointmentList } from './components/AppointmentList';
import { ReceptionistSummary } from './components/ReceptionistSummary';
import { InsightList } from './components/InsightList';
import { deriveReceptionistSummary, deriveTopInsights } from './insights';

export function DashboardPage() {
  const dashboard = useDashboard();
  const phone = usePhoneNumber();
  const receptionist = useReceptionistStatus();
  const firstName = useSessionStore((s) => s.user?.firstName);

  const conversations = useMemo(
    () => dashboard.data?.recentConversations ?? [],
    [dashboard.data?.recentConversations],
  );
  const summaryTiles = useMemo(
    () => deriveReceptionistSummary(conversations, dashboard.data?.metrics),
    [conversations, dashboard.data?.metrics],
  );
  const insightRows = useMemo(() => deriveTopInsights(conversations), [conversations]);

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
    <div className="space-y-8">
      <DashboardHeader firstName={firstName} receptionist={receptionist.data} />

      {(needsPhoneSetup || needsForwarding) && (
        <Link
          to="/settings/phone"
          className="focus-ring flex items-center gap-4 rounded-xl border border-accent-border bg-accent-subtle px-5 py-4 transition-colors duration-fast hover:border-accent"
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

      {/* Section 1 — analytics panel */}
      <AnalyticsPanel metrics={metrics} />

      {/* Sections 2 & 3 — Recent calls (primary) + Upcoming appointments */}
      <div className="grid gap-6 lg:grid-cols-5">
        <RecentCalls
          conversations={dashboard.data?.recentConversations}
          isLoading={dashboard.isLoading}
          className="lg:col-span-3"
        />
        <AppointmentList
          appointments={dashboard.data?.upcomingAppointments}
          isLoading={dashboard.isLoading}
          className="lg:col-span-2"
        />
      </div>

      {/* Sections 4 & 5 — Receptionist summary + Top customer insights */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReceptionistSummary tiles={summaryTiles} isLoading={dashboard.isLoading} />
        <InsightList rows={insightRows} isLoading={dashboard.isLoading} />
      </div>
    </div>
  );
}
