import { Link } from 'react-router-dom';
import {
  Building2,
  Activity,
  Phone,
  Flame,
  CalendarClock,
  ShieldAlert,
  CheckCircle2,
  Timer,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useAdminOverview } from '@/hooks/queries';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { KpiPanel } from './components/KpiPanel';
import { ADMIN_ROUTES } from './routes';

const ACTIVITY_ICON = {
  company_onboarded: Building2,
  emergency: ShieldAlert,
  lead: Flame,
  appointment: CalendarClock,
} as const;

export function AdminDashboardPage() {
  const overview = useAdminOverview();

  if (overview.isError) {
    return (
      <Card className="rounded-md">
        <ErrorState
          title="Couldn’t load the platform overview"
          message={(overview.error as Error).message}
          onRetry={() => void overview.refetch()}
        />
      </Card>
    );
  }

  const m = overview.data?.metrics;

  return (
    <div className="space-y-6">
      <KpiPanel
        items={[
          { icon: Building2, label: 'Total companies', value: m?.totalCompanies, tone: 'brand' },
          {
            icon: Activity,
            label: 'Active today',
            value: m?.activeCompaniesToday,
            tone: 'success',
            hint: 'Took at least one call',
          },
          { icon: Phone, label: 'Calls today', value: m?.callsToday, tone: 'brand' },
          { icon: Flame, label: 'Leads today', value: m?.leadsToday, tone: 'success' },
          {
            icon: CalendarClock,
            label: 'Appointments today',
            value: m?.appointmentsToday,
            tone: 'warning',
          },
          {
            icon: ShieldAlert,
            label: 'Emergencies today',
            value: m?.emergenciesToday,
            tone: 'emergency',
          },
          {
            icon: CheckCircle2,
            label: 'Resolution rate',
            value: m === undefined ? undefined : `${m.resolutionRate}%`,
            tone: 'success',
          },
          {
            icon: Timer,
            label: 'Avg. call length',
            value: m === undefined ? undefined : formatDuration(m.averageCallSeconds),
            tone: 'neutral',
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card as="section" className="overflow-hidden rounded-md lg:col-span-3">
          <CardHeader className="items-center">
            <CardTitle as="h2">Recent platform activity</CardTitle>
          </CardHeader>
          {overview.isLoading ? (
            <ListSkeleton rows={6} />
          ) : !overview.data?.recentActivity.length ? (
            <EmptyState
              icon={Activity}
              title="Nothing yet"
              description="Calls, leads and new companies will appear here as they happen."
            />
          ) : (
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {overview.data.recentActivity.map((event) => {
                const Icon = ACTIVITY_ICON[event.kind];
                return (
                  <li key={event.id} className="flex items-start gap-3 px-6 py-3.5">
                    <IconTile
                      icon={Icon}
                      size="sm"
                      tone={event.kind === 'emergency' ? 'emergency' : 'brand'}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {event.companyName ?? 'Unknown company'}
                        {event.description ? ` · ${event.description}` : ''}
                      </span>
                    </div>
                    <span className="shrink-0 text-caption text-ink-faint">
                      {timeAgo(event.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card as="section" className="overflow-hidden rounded-md lg:col-span-2">
          <CardHeader className="items-center">
            <CardTitle as="h2">Active companies today</CardTitle>
            <Link
              to={ADMIN_ROUTES.companies}
              className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </CardHeader>
          {overview.isLoading ? (
            <ListSkeleton rows={5} />
          ) : !overview.data?.activeCompanies.length ? (
            <CardContent>
              <p className="text-small text-ink-muted">No company has taken a call today.</p>
            </CardContent>
          ) : (
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {overview.data.activeCompanies.map((company) => (
                <li key={company.id}>
                  <Link
                    to={ADMIN_ROUTES.company(company.id)}
                    className="focus-ring flex items-center gap-3 px-6 py-3.5 transition-colors duration-fast hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {company.name}
                      </span>
                      <span className="font-num mt-0.5 block text-caption text-ink-faint">
                        {company.callsToday} calls · {company.leadsToday} leads ·{' '}
                        {company.appointmentsToday} appts
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
