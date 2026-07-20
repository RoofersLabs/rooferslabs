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
        'relative overflow-hidden rounded-2xl border border-mkt-line-subtle bg-mkt-surface shadow-mkt-sm',
        interactive &&
          'group transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-mkt-accent-border hover:shadow-mkt-lg',
        className,
      )}
    >
      {interactive && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-mkt-card-hover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}
      <div className="relative">{children}</div>
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
