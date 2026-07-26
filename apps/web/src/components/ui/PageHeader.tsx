import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The heading block every authenticated page opens with, including the
 * dashboard (see features/dashboard/components/DashboardHeader).
 *
 * One component owns the title size, the description size, and the 32px gap to
 * the first section below — the same rhythm the dashboard's own sections use —
 * so no page can arrive at a slightly different one on its own.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h2 text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-body-lg text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
