import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transition } from '../motion';
import type { CallStatus } from './data';

/**
 * Shared chrome for the product preview: the surfaces, headers and status
 * vocabulary that make the panels read as one application rather than a set of
 * marketing cards.
 */

/** A pulsing dot. The only looping animation on the page, and it is 2px wide. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-1.5 w-1.5 shrink-0', className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-mk-accent-fg opacity-60 motion-reduce:hidden" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-mk-accent-fg" />
    </span>
  );
}

/**
 * Status is never carried by colour alone: every badge pairs its tone with a
 * written label, and the emergency tone additionally leads with a dot.
 */
const STATUS_TONE: Record<CallStatus, string> = {
  emergency: 'border-white/25 bg-white/[0.09] text-white',
  booked: 'border-mk-accent-ring/40 bg-mk-accent/[0.16] text-mk-accent-fg',
  qualified: 'border-mk-line-strong bg-white/[0.04] text-white/70',
  followup: 'border-mk-line bg-white/[0.02] text-white/55',
};

export function StatusBadge({ status, label }: { status: CallStatus; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[11px] font-medium leading-4 tracking-[-0.005em]',
        STATUS_TONE[status],
      )}
    >
      {status === 'emergency' && <span className="h-1 w-1 rounded-full bg-white" />}
      {label}
    </span>
  );
}

/**
 * Panel heading. Always an `h3` regardless of whether the caller passed a
 * string or a node — a panel that decorates its title should not silently drop
 * out of the document outline.
 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
      {children}
    </h3>
  );
}

/**
 * The panel surface. Hover lifts the border rather than the card itself —
 * inside a dense dashboard, moving cards would read as noise.
 */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-mk-line bg-mk-card',
        'transition-colors duration-200 ease-smooth hover:border-mk-line-strong hover:bg-mk-card-hover',
        className,
      )}
    >
      {title && (
        <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-mk-line px-4">
          <PanelTitle>{title}</PanelTitle>
          {action}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

/** Numeric values are always tabular so columns of figures stay aligned. */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-num tabular-nums', className)}>{children}</span>
  );
}

const NAV = ['Overview', 'Calls', 'Appointments', 'Customers', 'Analytics'] as const;
export type NavItem = (typeof NAV)[number];
export const NAV_ITEMS = NAV;

/**
 * The application window. Rendered as a decorative preview: `aria-hidden`
 * would hide genuinely useful content from screen readers, so instead it is
 * exposed as a labelled figure and its controls are real buttons.
 */
export function AppFrame({
  children,
  nav,
  onNavigate,
  interactive = false,
  className,
}: {
  children: ReactNode;
  nav: NavItem;
  onNavigate?: (item: NavItem) => void;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-mk-line bg-[#050506]',
        'shadow-[0_40px_120px_-40px_rgba(43,92,230,0.28)]',
        className,
      )}
    >
      {/* Title bar */}
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-mk-line px-4">
        <div className="flex items-center gap-2 text-white">
          <svg viewBox="0 0 64 64" aria-hidden="true" className="h-4 w-4" fill="currentColor">
            <path d="M32 14 L54 36 L46 36 L46 50 L18 50 L18 36 L10 36 Z" />
          </svg>
          <span className="text-[12.5px] font-semibold tracking-[-0.01em]">Summit Roofing</span>
        </div>
        <div className="ml-auto hidden items-center gap-2 rounded-md border border-mk-line bg-white/[0.02] px-2.5 py-1 sm:flex">
          <LiveDot />
          <span className="text-[11.5px] text-white/60">Line active</span>
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-mk-line bg-white/[0.06] text-[10px] font-semibold text-white/80">
          SR
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar — folds away below `lg`, where the panels need the width */}
        <nav
          aria-label="Product preview sections"
          className="hidden w-[168px] shrink-0 flex-col gap-0.5 border-r border-mk-line p-2.5 lg:flex"
        >
          {NAV.map((item) => {
            const active = item === nav;
            const shared = cn(
              'relative flex items-center rounded-md px-2.5 py-[7px] text-[12.5px]',
              'transition-colors duration-200 ease-smooth',
              active ? 'text-white' : 'text-white/50',
            );

            if (!interactive || !onNavigate) {
              return (
                <span key={item} className={shared} aria-current={active ? 'true' : undefined}>
                  {active && (
                    <span className="absolute inset-0 rounded-md bg-white/[0.06]" aria-hidden />
                  )}
                  <span className="relative">{item}</span>
                </span>
              );
            }

            return (
              <button
                key={item}
                type="button"
                onClick={() => onNavigate(item)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  shared,
                  'text-left hover:text-white/80',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring',
                )}
              >
                {active && (
                  // One shared element slides between items instead of five
                  // independent fades — the highlight reads as a single object.
                  <motion.span
                    layoutId="preview-nav-active"
                    className="absolute inset-0 rounded-md bg-white/[0.07]"
                    transition={transition.base}
                  />
                )}
                <span className="relative">{item}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
