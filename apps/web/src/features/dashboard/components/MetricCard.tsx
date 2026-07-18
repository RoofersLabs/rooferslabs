import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

/** Icon-tile tone palette, mapped onto the shared semantic tokens. */
const toneStyles = {
  brand: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  emergency: 'bg-emergency-subtle text-emergency',
  warning: 'bg-warning-subtle text-warning',
  slate: 'bg-surface-3 text-ink-muted',
} as const;

export type MetricTone = keyof typeof toneStyles;

/**
 * A single KPI tile for the top of the dashboard: small icon, large number,
 * label, and an optional muted comparison line. 16px radius, calm elevation.
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'slate',
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  tone?: MetricTone;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-surface p-5 shadow-card">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          toneStyles[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        {value === undefined ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <span className="font-num block text-h2 leading-none text-ink">{value}</span>
        )}
        <span className="mt-2 block text-small font-medium text-ink-muted">{label}</span>
        {hint && <span className="mt-1 block text-caption text-ink-faint">{hint}</span>}
      </div>
    </div>
  );
}
