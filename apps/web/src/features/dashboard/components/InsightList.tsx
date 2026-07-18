import { BarChart3 } from 'lucide-react';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { InsightRow } from '../insights';
import { SectionCard } from './SectionCard';

/**
 * Ranked list of what recent callers wanted, with a share percentage and a
 * slim proportion bar for scannability. No charts — just a sorted list.
 */
export function InsightList({
  rows,
  isLoading,
  className,
}: {
  rows: InsightRow[];
  isLoading: boolean;
  className?: string;
}) {
  return (
    <SectionCard title="Top customer insights" className={className}>
      {isLoading ? (
        <div className="border-t border-line-subtle">
          <ListSkeleton rows={5} />
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={BarChart3}
          title="Not enough data yet"
          description="Once the AI has handled a few calls, you’ll see what your customers ask for most."
        />
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {rows.map((row, index) => (
            <li key={row.label} className="px-6 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-num w-4 shrink-0 text-caption text-ink-faint">
                    {index + 1}
                  </span>
                  <span className="truncate text-body text-ink">{row.label}</span>
                </span>
                <span className="font-num shrink-0 text-small font-medium text-ink-muted">
                  {row.percent}%
                </span>
              </div>
              <div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-base ease-standard"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
