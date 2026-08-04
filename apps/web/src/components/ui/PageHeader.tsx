import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The heading block every authenticated page opens with, including the
 * dashboard (see features/dashboard/components/DashboardHeader).
 *
 * One component owns the title size, the description size, and the gap to the
 * first section below, so no page can arrive at a slightly different one.
 *
 * The type steps down below `sm` rather than scaling fluidly. A 32px heading
 * and an 18px description cost ~300px above the first card on a 390px phone —
 * over a third of the viewport spent before any data. Product UI wants a fixed
 * rem scale at a given breakpoint and structural changes between them, which is
 * what this is: two committed sizes, not a clamp.
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
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h3 text-ink sm:text-h2">{title}</h1>
        {description && (
          <p className="mt-1 text-body text-ink-muted sm:text-body-lg">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
