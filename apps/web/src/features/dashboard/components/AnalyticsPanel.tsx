import type { LucideIcon } from 'lucide-react';
import { Phone, Flame, ShieldAlert, CalendarClock, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconTile, type IconTileTone } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardOverview } from '@/types/api';

type Metric = {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  tone: IconTileTone;
};

/**
 * A single column within the analytics panel: small colored icon tile, large
 * metric number, title, and a muted comparison line. Rendered flush so the four
 * columns read as one panel divided by hairlines, never as four separate cards.
 */
function MetricColumn({ icon, label, value, tone }: Metric) {
  return (
    <div className="flex flex-col gap-4 bg-surface p-6">
      <IconTile icon={icon} tone={tone} shape="square" />
      <div>
        {value === undefined ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <span className="font-num block text-h2 leading-none text-ink">{value}</span>
        )}
        <span className="mt-2 block text-small font-medium text-ink-muted">{label}</span>
        {/* No day-over-day analytics are wired up yet — show a neutral, honest
            placeholder in the comparison slot until real trends are connected. */}
        <span className="mt-1.5 flex items-center gap-1 text-caption text-ink-faint">
          <Minus className="h-3 w-3" aria-hidden />
          vs. yesterday
        </span>
      </div>
    </div>
  );
}

/**
 * Full-width analytics panel: one container holding the day's headline KPIs as
 * equal-width columns separated by hairline dividers. Reflows to two columns on
 * tablet and a single stacked column on mobile. It uses the shared `Card`
 * surface so its radius, border and elevation match every other panel in the
 * product rather than being a slightly rounder one-off.
 */
export function AnalyticsPanel({ metrics }: { metrics: DashboardOverview['metrics'] | undefined }) {
  const items: Metric[] = [
    { icon: Phone, label: 'Calls today', value: metrics?.todaysCalls, tone: 'brand' },
    { icon: Flame, label: 'Leads today', value: metrics?.todaysLeads, tone: 'success' },
    {
      icon: ShieldAlert,
      label: 'Emergencies today',
      value: metrics?.todaysEmergencies,
      tone: 'emergency',
    },
    {
      icon: CalendarClock,
      label: 'Pending appointments',
      value: metrics?.pendingAppointments,
      tone: 'warning',
    },
  ];

  return (
    <Card as="section" aria-label="Today’s key metrics" className="overflow-hidden">
      <div className="grid grid-cols-1 gap-px bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <MetricColumn key={item.label} {...item} />
        ))}
      </div>
    </Card>
  );
}
