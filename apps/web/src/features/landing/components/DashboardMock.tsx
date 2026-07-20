import {
  BarChart3,
  Bell,
  CalendarClock,
  BookOpen,
  LayoutDashboard,
  Phone,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A representative RoofersLabs dashboard, rendered in DOM.
 *
 * Chosen over a screenshot deliberately: it stays sharp on any display, follows
 * the marketing theme, adds no image weight to LCP, and can't silently go stale
 * when the real dashboard changes. Figures are illustrative sample data.
 */

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Phone, label: 'Calls' },
  { icon: Users, label: 'Customers' },
  { icon: CalendarClock, label: 'Appointments' },
  { icon: BookOpen, label: 'Knowledge' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Bell, label: 'Notifications' },
  { icon: Settings, label: 'Settings' },
];

const CALLS = [
  { name: 'Dana Whitfield', reason: 'Storm damage — shingles', time: '2m ago', tag: 'Emergency' },
  { name: 'Marcus Reyes', reason: 'Roof inspection quote', time: '14m ago', tag: 'Booked' },
  { name: 'Priya Raman', reason: 'Gutter replacement', time: '38m ago', tag: 'Qualified' },
  { name: 'Tom Alvarez', reason: 'Leak above garage', time: '1h ago', tag: 'Emergency' },
];

const TAGS: Record<string, string> = {
  Emergency: 'bg-mkt-warn-soft text-mkt-warn',
  Booked: 'bg-mkt-success-soft text-mkt-success',
  Qualified: 'bg-mkt-accent-soft text-mkt-accent',
};

/**
 * Weekly call volume — the shape tells the story (a storm-day spike on the
 * weekend), so it's fixed rather than random. Paired with its label so the
 * render doesn't index two arrays in lockstep.
 */
const VOLUME = [
  { day: 'M', height: 38 },
  { day: 'T', height: 52 },
  { day: 'W', height: 44 },
  { day: 'T', height: 61 },
  { day: 'F', height: 72 },
  { day: 'S', height: 58 },
  { day: 'S', height: 83 },
];

export function DashboardMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-h-[22rem] bg-mkt-bg text-left">
      {/* Sidebar — hidden on small screens where it would crush the content. */}
      <aside className="hidden w-48 shrink-0 border-r border-mkt-line-subtle bg-mkt-bg-subtle p-3 sm:block">
        <div className="mb-4 flex items-center gap-2 px-2 py-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-mkt-cta text-[0.625rem] font-bold text-mkt-accent-ink">
            R
          </span>
          <span className="text-xs font-semibold text-mkt-ink">RoofersLabs</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.6875rem]',
                active
                  ? 'bg-mkt-accent-soft font-medium text-mkt-accent'
                  : 'text-mkt-ink-faint',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-mkt-ink">Good morning, Ray</p>
            <p className="text-[0.6875rem] text-mkt-ink-faint">
              4 new leads captured while you were on the roof
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-mkt-success-soft px-2.5 py-1 text-[0.625rem] font-medium text-mkt-success sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-mkt-success" aria-hidden />
            AI active
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { k: 'Calls today', v: '27', d: '+12%' },
            { k: 'Booked', v: '9', d: '+3' },
            { k: 'Avg. pickup', v: '1.8s', d: '' },
            { k: 'Missed', v: '0', d: '' },
          ].map((m) => (
            <div
              key={m.k}
              className="rounded-xl border border-mkt-line-subtle bg-mkt-surface p-2.5"
            >
              <p className="text-[0.625rem] uppercase tracking-wide text-mkt-ink-faint">{m.k}</p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums text-mkt-ink">{m.v}</span>
                {m.d && <span className="text-[0.625rem] text-mkt-success">{m.d}</span>}
              </p>
            </div>
          ))}
        </div>

        <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'lg:grid-cols-5')}>
          <div
            className={cn(
              'rounded-xl border border-mkt-line-subtle bg-mkt-surface p-3',
              !compact && 'lg:col-span-3',
            )}
          >
            <p className="mb-2 text-[0.6875rem] font-medium text-mkt-ink">Recent calls</p>
            <ul className="flex flex-col gap-1.5">
              {CALLS.map((c) => (
                <li key={c.name} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mkt-bg-subtle text-[0.5625rem] font-semibold text-mkt-ink-muted">
                    {c.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.6875rem] font-medium text-mkt-ink">
                      {c.name}
                    </span>
                    <span className="block truncate text-[0.625rem] text-mkt-ink-faint">
                      {c.reason}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'hidden shrink-0 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium sm:inline',
                      TAGS[c.tag],
                    )}
                  >
                    {c.tag}
                  </span>
                  <span className="shrink-0 text-[0.5625rem] tabular-nums text-mkt-ink-faint">
                    {c.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!compact && (
            <div className="rounded-xl border border-mkt-line-subtle bg-mkt-surface p-3 lg:col-span-2">
              <p className="mb-1 text-[0.6875rem] font-medium text-mkt-ink">Call volume</p>
              <p className="mb-3 text-[0.625rem] text-mkt-ink-faint">Last 7 days</p>
              <div
                className="flex h-20 items-end gap-1.5"
                role="img"
                aria-label="Call volume over the last seven days, trending upward"
              >
                {VOLUME.map(({ day, height }, i) => (
                  <span key={`${day}-${i}`} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="w-full rounded-t bg-mkt-cta"
                      style={{ height: `${height}%`, opacity: 0.55 + (i / VOLUME.length) * 0.45 }}
                    />
                    <span className="text-[0.5rem] text-mkt-ink-faint">{day}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
