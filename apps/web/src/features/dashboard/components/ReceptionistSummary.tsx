import { Skeleton } from '@/components/ui/skeleton';
import type { SummaryTile } from '../insights';
import { SectionCard } from './SectionCard';

/** Four compact, chart-free operational metrics for the AI receptionist. */
export function ReceptionistSummary({
  tiles,
  isLoading,
  className,
}: {
  tiles: SummaryTile[];
  isLoading: boolean;
  className?: string;
}) {
  return (
    <SectionCard title="AI receptionist summary" className={className}>
      <div className="grid grid-cols-2 gap-px border-t border-line-subtle bg-line-subtle">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface p-5">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="mt-3 h-4 w-24" />
              </div>
            ))
          : tiles.map((tile) => (
              <div key={tile.label} className="bg-surface p-5">
                <div className="flex items-center gap-2 text-ink-muted">
                  <tile.icon className="h-4 w-4" aria-hidden />
                  <span className="text-small font-medium">{tile.label}</span>
                </div>
                <p className="font-num mt-3 text-h4 leading-none text-ink">{tile.value}</p>
                <p className="mt-2 text-caption text-ink-faint">{tile.hint}</p>
              </div>
            ))}
      </div>
    </SectionCard>
  );
}
