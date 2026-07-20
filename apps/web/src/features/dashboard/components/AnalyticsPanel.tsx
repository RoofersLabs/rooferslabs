import type { LucideIcon } from 'lucide-react';
import { Phone, Flame, ShieldAlert, CalendarClock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardOverview } from '@/types/api';

/** Icon-tile tone palette, mapped onto the shared semantic tokens. */
const toneStyles = {
  brand: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  emergency: 'bg-emergency-subtle text-emergency',
  warning: 'bg-warning-subtle text-warning',
} as const;

type MetricTone = keyof typeof toneStyles;

type Metric = {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  tone: MetricTone;
};

/**
 * A single column within the analytics panel: small colored icon tile, large
 * metric number, title, and a muted comparison line. Rendered flush so the four
 * columns read as one panel divided by hairlines, never as four separate cards.
 */
function MetricColumn({ icon: Icon, label, value, tone }: Metric) {
  return (
    <div className="flex flex-col gap-4 bg-surface p-6">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          toneStyles[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
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
 * Full-width analytics panel: one premium container holding the day's headline
 * KPIs as equal-width columns separated by subtle hairline dividers. Reflows to
 * two columns on tablet and a single stacked column on mobile. A single hover
 * elevation applies to the whole container, keeping it one cohesive component.
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
    <section
      aria-label="Today’s key metrics"
      className="overflow-hidden rounded-2xl border border-line-subtle bg-surface shadow-card transition-shadow duration-base ease-standard hover:shadow-card-hover"
    >
      <div className="grid grid-cols-1 gap-px bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <MetricColumn key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}
