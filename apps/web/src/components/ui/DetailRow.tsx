import { cn } from '@/lib/utils';

/**
 * One label/value pair inside a `<dl>`.
 *
 * The conversation detail sidebar, the billing summary and the onboarding
 * review step each grew their own copy of this and drifted into three slightly
 * different paddings. An empty value renders an em dash rather than a blank
 * cell, so a missing field always reads as "not set" rather than as a bug.
 */
export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={cn('flex justify-between gap-6 py-2.5 text-small', className)}>
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{value || '—'}</dd>
    </div>
  );
}
