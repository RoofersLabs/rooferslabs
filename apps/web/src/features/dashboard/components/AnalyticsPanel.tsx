import { Card } from '@/components/ui/card';
import { IconTile, type IconTileTone } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardOverview } from '@/types/api';
import {
  CalendarDaysIcon,
  FireIcon,
  MinusIcon,
  PhoneIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type { IconComponent } from '@/components/ui/icon';

type Metric = {
  icon: IconComponent;
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
    // `p-5` on mobile, where two columns share the width; `p-6` from `sm` up,
    // which is the gutter every other dashboard panel uses.
    <div className="flex flex-col gap-4 bg-surface p-5 sm:p-6">
      <IconTile icon={icon} tone={tone} />
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
          <MinusIcon className="h-4 w-4" aria-hidden />
          vs. yesterday
        </span>
      </div>
    </div>
  );
}

/**
 * Full-width analytics panel: one container holding the day's headline KPIs as
 * equal-width columns separated by hairline dividers. Four across on desktop,
 * folding to a 2×2 grid of equal cells from tablet down. It uses the shared `Card` for
 * its border and elevation, overriding only the radius so it matches the other
 * dashboard panels rather than being a rounder one-off among them.
 */
export function AnalyticsPanel({ metrics }: { metrics: DashboardOverview['metrics'] | undefined }) {
  const items: Metric[] = [
    { icon: PhoneIcon, label: 'Calls today', value: metrics?.todaysCalls, tone: 'brand' },
    { icon: FireIcon, label: 'Leads today', value: metrics?.todaysLeads, tone: 'success' },
    {
      icon: ShieldExclamationIcon,
      label: 'Emergencies today',
      value: metrics?.todaysEmergencies,
      tone: 'emergency',
    },
    {
      icon: CalendarDaysIcon,
      label: 'Pending appointments',
      value: metrics?.pendingAppointments,
      tone: 'warning',
    },
  ];

  return (
    <Card as="section" aria-label="Today’s key metrics" className="overflow-hidden">
      {/* Two up on a phone, not stacked: four full-width rows pushed the calls
          list off the bottom of the screen. `auto-rows-fr` equalises the two
          rows so all four cells are the same height whether or not a label
          wraps — the grid stays square rather than ragged. */}
      <div className="grid auto-rows-fr grid-cols-2 gap-px bg-line-subtle lg:grid-cols-4">
        {items.map((item) => (
          <MetricColumn key={item.label} {...item} />
        ))}
      </div>
    </Card>
  );
}
