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
