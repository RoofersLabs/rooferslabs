import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ENTER } from './config';

/**
 * Sidebar, top bar, and the panel shell — the parts of the dashboard that frame
 * the content rather than being it.
 */

type NavItem = { label: string; active?: boolean };

const NAV: NavItem[] = [
  { label: 'CRM' },
  { label: 'Calls', active: true },
  { label: 'Customers' },
  { label: 'Appointments' },
  { label: 'Knowledge Base' },
  { label: 'Analytics' },
];

/**
 * Nine-pixel monoline glyphs, drawn per item.
 *
 * A real icon set for a decorative sidebar would be a dependency and a network
 * request for nine shapes nobody clicks. These are drawn to one stroke weight
 * and one corner radius, which is what actually makes a sidebar look designed.
 */
function NavGlyph({ label }: { label: string }) {
  const paths: Record<string, JSX.Element> = {
    CRM: <path d="M2 12.5V4a1 1 0 0 1 1-1h4v9.5M7 6.5h4a1 1 0 0 1 1 1v5" />,
    Calls: <path d="M3 3h2l1 2.5-1.2.8a7 7 0 0 0 3 3l.8-1.2L11 9v2a1 1 0 0 1-1.1 1A9 9 0 0 1 2 4.1 1 1 0 0 1 3 3Z" />,
    Customers: (
      <>
        <circle cx="5.5" cy="5" r="2" />
        <path d="M2 12.5v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1M10.5 4.2a2 2 0 0 1 0 3.6" />
      </>
    ),
    Appointments: (
      <>
        <rect x="2" y="3.5" width="10" height="9" rx="1.5" />
        <path d="M2 6.5h10M5 2v2M9 2v2" />
      </>
    ),
    'Knowledge Base': <path d="M2 3.5A1 1 0 0 1 3 2.5h2.5A1.5 1.5 0 0 1 7 4a1.5 1.5 0 0 1 1.5-1.5H11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8.5A1.5 1.5 0 0 0 7 13a1.5 1.5 0 0 0-1.5-1.5H3a1 1 0 0 1-1-1ZM7 4v9" />,
    Analytics: <path d="M2 12.5h10M4 12.5V8M7 12.5V4.5M10 12.5V6.5" />,
    Settings: (
      <>
        <circle cx="7" cy="7.5" r="1.8" />
        <path d="M7 1.8v1.6M7 11.6v1.6M12 4.6l-1.4.8M3.4 9.6 2 10.4M12 10.4l-1.4-.8M3.4 5.4 2 4.6" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 14 15"
      width={14}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {paths[label]}
    </svg>
  );
}

export function Sidebar() {
  return (
    <nav
      aria-label="Dashboard"
      className="hidden w-[168px] shrink-0 flex-col border-r border-subtle bg-white/[0.012] p-2.5 md:flex"
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[0.5rem] font-bold text-white">
          SR
        </span>
        <span className="truncate text-[0.6875rem] font-medium">Summit Roofing</span>
      </div>

      <ul className="mt-2 space-y-px">
        {NAV.map((item) => (
          <li key={item.label}>
            <span
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[0.6875rem] transition-colors duration-150 ease-out',
                item.active
                  ? 'bg-white/[0.07] text-ink'
                  : 'text-ink-tertiary hover:bg-white/[0.03] hover:text-ink-secondary',
              )}
            >
              <NavGlyph label={item.label} />
              <span className="truncate">{item.label}</span>
            </span>
          </li>
        ))}
      </ul>

      <ul className="mt-auto space-y-px border-t border-subtle pt-2">
        <li>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[0.6875rem] text-ink-tertiary">
            <NavGlyph label="Settings" />
            Settings
          </span>
        </li>
      </ul>
    </nav>
  );
}

/**
 * Top bar. The notification is the last beat of the sequence — the moment the
 * system tells you it did the work, which is the whole product in one line.
 */
export function TopBar({ notified }: { notified: boolean }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-subtle px-3">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {['#2B2D31', '#2B2D31', '#2B2D31'].map((color, index) => (
          <span
            key={index}
            className="h-[7px] w-[7px] rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      {/* Capped rather than fluid: a search field stretched across the full
          width of the window is a layout accident, not a control. */}
      <div className="ml-1 hidden min-w-0 max-w-[240px] flex-1 items-center gap-2 rounded-md border border-subtle bg-white/[0.02] px-2.5 py-1 sm:flex">
        <svg
          viewBox="0 0 14 14"
          width={11}
          height={11}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          className="shrink-0 text-ink-quaternary"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4" />
          <path d="m9 9 3.5 3.5" strokeLinecap="round" />
        </svg>
        <span className="truncate text-[0.6875rem] text-ink-quaternary">
          Search calls, customers, jobs
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <AnimatePresence>
          {notified && (
            <motion.span
              // Exits faster than it enters: the system is deciding when to
              // speak, and responding instantly when it stops.
              initial={{ opacity: 0, transform: 'translateY(-4px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={ENTER}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent/25 bg-accent/10 px-2 py-1 text-[0.625rem] font-medium text-accent"
            >
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              Appointment booked
            </motion.span>
          )}
        </AnimatePresence>

        <span
          className="h-6 w-6 shrink-0 rounded-full border border-subtle bg-white/[0.05]"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * The one surface every panel is built on.
 *
 * A hairline border and a barely-there fill. On near-black that is enough to
 * establish a plane; anything heavier becomes the glassmorphism this design
 * rules out.
 */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        // `h-full` is load-bearing: a grid item stretches to its row, but this
        // block-level flex child inside it would otherwise size to its own
        // content and spill over the panel below.
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-subtle bg-white/[0.015]',
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-subtle px-3">
        <h3 className="truncate text-[0.6875rem] font-medium text-ink-secondary">{title}</h3>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
