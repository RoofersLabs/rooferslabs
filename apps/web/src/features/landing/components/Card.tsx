import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The marketing card. `interactive` adds the gradient hover wash from the token
 * file — a whisper of accent from the top edge, not a background colour change,
 * which is what keeps a grid of these from looking like a dashboard.
 */
export function MktCard({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-mkt-line bg-mkt-surface shadow-mkt-sm',
        // `mkt-card-hover` carries the lift + timing; the border and shadow
        // changes ride along on it. Kept in CSS rather than Tailwind `hover:`
        // utilities so the whole thing can be gated behind `(hover: hover)`.
        interactive && 'mkt-card-interactive group',
        className,
      )}
    >
      {interactive && (
        <span
          aria-hidden
          className="mkt-card-wash pointer-events-none absolute inset-0 bg-mkt-card-hover opacity-0"
        />
      )}
      {/* Full-height flex column so cards in a row can push trailing content
          (a meta line, a footer link) to the bottom with `mt-auto` and stay
          aligned across the row regardless of body-copy length. */}
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  );
}

/** Square icon tile used at the top of feature cards. */
export function IconTile({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'muted';
}) {
  return (
    <span
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border',
        tone === 'accent'
          ? 'border-mkt-accent-border bg-mkt-accent-soft text-mkt-accent'
          : 'border-mkt-line bg-mkt-bg-subtle text-mkt-ink-muted',
      )}
    >
      {children}
    </span>
  );
}
