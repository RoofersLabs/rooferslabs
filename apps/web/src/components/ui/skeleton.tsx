import { cn } from '@/lib/utils';

/** Shimmering placeholder block used while content loads. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse bg-surface-3', className)} aria-hidden {...props} />;
}

/**
 * Placeholder for list/table panels: rows of avatar + text lines, laid out on
 * the same 24px gutter and row height as the real rows they stand in for, so
 * content does not visibly shift sideways when it arrives.
 */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading content" className="divide-y divide-line-subtle">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
