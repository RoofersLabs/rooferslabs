import { cn, formatPhone, humanizeEnum } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { IconTile, type IconTileTone } from '@/components/ui/IconTile';
import { ICON_SIZE, type IconComponent } from '@/components/ui/icon';
import { EnumStatusLabel } from '@/features/dashboard/components/StatusLabel';
import {
  ArrowTrendingUpIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  PhoneIcon,
  PhoneXMarkIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { COMPANY, appointments, calls, insightRows, metrics, summaryTiles } from '../data';
import { CountUp, ProportionBar, Reveal, StaggerList, StaggerRow } from '../animation';
import { PanelCard, PreviewPageHeader, type ViewId } from '../chrome';
import { usePhone, useWide } from '../formFactor';

/**
 * The dashboard, section for section as `features/dashboard/DashboardPage`
 * renders it: greeting and receptionist chips, the four-column analytics panel,
 * recent calls beside upcoming appointments, then the receptionist summary
 * beside the top customer insights.
 *
 * The one difference is what fills it. The product ships careful empty states
 * for a company that has not taken a call yet; a visitor deciding whether to
 * sign up needs to see the other end — a working day's worth of calls, leads
 * and appointments already in place.
 */

const METRIC_ICONS: Record<string, { icon: IconComponent; tone: IconTileTone }> = {
  calls: { icon: PhoneIcon, tone: 'brand' },
  leads: { icon: FireIcon, tone: 'success' },
  emergencies: { icon: ShieldExclamationIcon, tone: 'emergency' },
  appointments: { icon: CalendarDaysIcon, tone: 'warning' },
};

const SUMMARY_ICONS: Record<string, IconComponent> = {
  resolution: CheckCircleIcon,
  length: ClockIcon,
  hours: BoltIcon,
  missed: PhoneXMarkIcon,
};

export function DashboardView({
  onNavigate,
  /** Live figures from the showcase, so today's numbers can move while you watch. */
  kpi,
  /** Whether a call has landed since the page opened — marks the newest row. */
  fresh = false,
}: {
  onNavigate: (id: ViewId) => void;
  kpi?: Partial<Record<string, number>>;
  fresh?: boolean;
}) {
  const phone = usePhone();
  const wide = useWide();

  return (
    <div className="space-y-4">
      <Reveal as="header">
        <PreviewPageHeader
          title={`Good morning, ${COMPANY.firstName}!`}
          description="Here’s what’s happening with your business today."
          actions={
            <>
              <StatusChip label="AI receptionist active" />
              <StatusChip label="Forwarding verified" />
            </>
          }
        />
      </Reveal>

      {/* Section 1 — analytics panel */}
      <Reveal index={1}>
        <Card as="section" aria-label="Today’s key metrics" className="overflow-hidden">
          <div
            className={cn(
              // `grid-cols-2 lg:grid-cols-4`, as the panel has it. Four across
              // is a desk layout: an iPad in portrait gives this panel ~510px
              // once the sidebar has its rail, and four columns of that are
              // 127px each — not enough for "↗ +12% vs. yesterday", which then
              // ran out of its cell.
              'grid auto-rows-fr gap-px bg-line-subtle',
              wide ? 'grid-cols-4' : 'grid-cols-2',
            )}
          >
            {metrics.map((metric) => {
              const glyph = METRIC_ICONS[metric.key];
              return (
                <div
                  key={metric.key}
                  className={cn(
                    'flex flex-col gap-4 bg-surface transition-colors duration-fast ease-standard hover:bg-surface-2',
                    phone ? 'p-5' : 'p-6',
                  )}
                >
                  {glyph && <IconTile icon={glyph.icon} tone={glyph.tone} />}
                  <div>
                    <span className="font-num block text-h2 leading-none text-ink">
                      <CountUp value={kpi?.[metric.key] ?? metric.value} />
                    </span>
                    <span className="mt-2 block text-small font-medium text-ink-muted">
                      {metric.label}
                    </span>
                    {/* `nowrap`, and the qualifier only on a tablet: at 390px
                        two of these columns share ~115px of content width,
                        which is not enough for the arrow, the delta and "vs.
                        yesterday" on one line — it broke after the delta and
                        left an orphaned "yesterday" on a second row. The arrow
                        and the figure carry the comparison on a phone; the
                        words come back as soon as there is room for them. */}
                    <span className="mt-1.5 flex items-center gap-1 whitespace-nowrap text-caption text-ink-faint">
                      <ArrowTrendingUpIcon className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      <span className="font-num text-success">{metric.delta}</span>
                      {!phone && <span>vs. yesterday</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>

      {/* Sections 2 & 3 — Recent calls (primary) + Upcoming appointments.

          `min-w-0` on the items is load-bearing, and for the same reason it is
          on `SidebarInset` in the application: a grid item defaults to
          `min-width: auto`, so the track cannot shrink below its content's
          min-content. A call row's second line ("Emergency repair · (614)
          555-0182") is one unbreakable run, and inside the preview's narrower
          column that floored this panel at 441px against 310px of space —
          scrolling the whole dashboard sideways on a phone. The rows already
          truncate; this is what lets them. */}
      <div className={cn('grid gap-4', wide && 'grid-cols-5')}>
        <Reveal index={2} className={cn('min-w-0', wide && 'col-span-3')}>
          <PanelCard
            title="Recent calls"
            action={{ label: 'View all calls', onSelect: () => onNavigate('calls') }}
            className="h-full"
          >
            <StaggerList className="divide-y divide-line-subtle border-t border-line-subtle">
              {calls.slice(0, 5).map((call, index) => (
                <StaggerRow key={call.id}>
                  <div
                    className={cn(
                      'flex items-center gap-4 px-6 py-4 transition-colors duration-base hover:bg-surface-2',
                      // The row that arrived while the page was open. It is a
                      // tint and a rail, not a badge: the log is read top-down
                      // and the newest row is already the one being read.
                      fresh && index === 0 && 'bg-accent-subtle/50',
                    )}
                  >
                    <IconTile
                      icon={call.isEmergency ? ShieldExclamationIcon : PhoneIcon}
                      tone={call.isEmergency ? 'emergency' : 'brand'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {call.name}
                      </span>
                      <span className="mt-0.5 block truncate text-small text-ink-muted">
                        {humanizeEnum(call.intent)}
                        <span aria-hidden className="text-ink-faint">
                          {' · '}
                        </span>
                        <span className="font-num">{formatPhone(call.phone)}</span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex shrink-0 flex-col items-end text-right',
                        phone ? 'w-28' : 'w-36',
                      )}
                    >
                      <EnumStatusLabel value={call.outcome} className="max-w-full truncate" />
                      <span className="mt-1 text-small text-ink-muted">
                        {fresh && index === 0 ? 'Just now' : call.ago}
                      </span>
                      <span className="font-num mt-0.5 text-caption text-ink-faint">
                        {call.duration}
                      </span>
                    </span>
                  </div>
                </StaggerRow>
              ))}
            </StaggerList>
          </PanelCard>
        </Reveal>

        <Reveal index={3} className={cn('min-w-0', wide && 'col-span-2')}>
          <PanelCard
            title="Upcoming appointments"
            action={{ label: 'View calendar', onSelect: () => onNavigate('appointments') }}
            className="h-full"
          >
            <StaggerList as="ol" className="border-t border-line-subtle px-6 py-5">
              {appointments.slice(0, 4).map((appointment, index, list) => (
                <StaggerRow key={appointment.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <span className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-accent bg-surface" />
                    {index < list.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-line-subtle" aria-hidden />
                    )}
                  </span>
                  <div className="-mt-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-ink">
                        {appointment.name}
                      </span>
                      <EnumStatusLabel value={appointment.priority} />
                    </div>
                    <p className="mt-0.5 truncate text-small text-ink-muted">
                      {appointment.service}
                    </p>
                    <p className="font-num mt-1 text-caption text-ink-faint">
                      {appointment.when} · {appointment.window}
                    </p>
                  </div>
                </StaggerRow>
              ))}
            </StaggerList>
          </PanelCard>
        </Reveal>
      </div>

      {/* Sections 4 & 5 — Receptionist summary + Top customer insights. Insights
          is desktop-only in the product, and stays desktop-only here. */}
      <div className={cn('grid gap-4', wide && 'grid-cols-2')}>
        <Reveal index={4} className="min-w-0">
          <PanelCard title="AI receptionist summary" className="h-full">
            <div className="grid grid-cols-2 gap-px border-t border-line-subtle bg-line-subtle">
              {summaryTiles.map((tile) => {
                const Icon = SUMMARY_ICONS[tile.key];
                return (
                  <div
                    key={tile.key}
                    className="bg-surface p-5 transition-colors duration-fast ease-standard hover:bg-surface-2"
                  >
                    <div className="flex items-center gap-2 text-ink-muted">
                      {Icon && <Icon className={ICON_SIZE.status} aria-hidden />}
                      <span className="text-small font-medium">{tile.label}</span>
                    </div>
                    <p className="font-num mt-3 text-h4 leading-none text-ink">{tile.value}</p>
                    <p className="mt-2 text-caption text-ink-faint">{tile.hint}</p>
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </Reveal>

        <Reveal index={5} className={cn('min-w-0', !wide && 'hidden')}>
          <PanelCard title="Top customer insights" className="h-full">
            <StaggerList className="divide-y divide-line-subtle border-t border-line-subtle">
              {insightRows.map((row, index) => (
                <StaggerRow key={row.label} className="px-6 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="font-num w-4 shrink-0 text-caption text-ink-faint">
                        {index + 1}
                      </span>
                      <span className="truncate text-body text-ink">{row.label}</span>
                    </span>
                    <span className="font-num shrink-0 text-small font-medium text-ink-muted">
                      {row.percent}%
                    </span>
                  </div>
                  <ProportionBar percent={row.percent} />
                </StaggerRow>
              ))}
            </StaggerList>
          </PanelCard>
        </Reveal>
      </div>
    </div>
  );
}

/**
 * The receptionist status chips from `DashboardHeader`. Flat coloured text with
 * a dot — the dot is the non-colour signal, and it is why the state survives a
 * screen the reader cannot see colour on.
 */
function StatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
      {label}
    </span>
  );
}
