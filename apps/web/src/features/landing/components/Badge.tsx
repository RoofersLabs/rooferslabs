import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Small pill used for eyebrows, status chips and feature tags. */
export function MktBadge({
  children,
  className,
  tone = 'accent',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'accent' | 'neutral' | 'success';
}) {
  const tones = {
    accent: 'bg-mkt-accent-soft text-mkt-accent border-mkt-accent-border',
    neutral: 'bg-mkt-surface text-mkt-ink-muted border-mkt-line',
    success: 'bg-mkt-success-soft text-mkt-success border-transparent',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge with a live pulse dot — used only where something is genuinely live. */
export function LiveBadge({ children }: { children: ReactNode }) {
  return (
    <MktBadge tone="accent" className="backdrop-blur-sm">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mkt-success opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mkt-success" />
      </span>
      {children}
    </MktBadge>
  );
}
