import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The search/filter row that sits at the top of a list surface.
 *
 * Every list page puts its controls in the same place, on the same 24px gutter
 * as the rows beneath, separated by the same hairline — so moving between
 * Calls, Customers and the Knowledge Base never moves the search box.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-line-subtle px-6 py-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  );
}
