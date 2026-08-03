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
  wrap = false,
  className,
}: {
  label: string;
  value: string | null | undefined;
  /**
   * Let a long value run onto further lines instead of being cut off. Truncation
   * is right for a phone number or a timezone, where the tail is predictable,
   * and wrong for a sentence — the onboarding review shows the caller greeting,
   * and a greeting the user cannot finish reading is not something they can
   * confirm. Rows stack their label above the value when they wrap, so the text
   * gets the full width.
   */
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'gap-x-6 py-2.5 text-small',
        wrap ? 'flex flex-col gap-y-1 sm:flex-row sm:justify-between' : 'flex justify-between',
        className,
      )}
    >
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd
        className={cn(
          'min-w-0 font-medium text-ink',
          wrap ? 'break-words sm:text-right' : 'truncate text-right',
        )}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
