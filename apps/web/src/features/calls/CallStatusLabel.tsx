import { cn, humanizeEnum } from '@/lib/utils';

/**
 * The Calls page's flat status indicator.
 *
 * A Calls-scoped counterpart to the shared `EnumBadge`: identical tone mapping,
 * rendered as bare semibold colored text with no fill, border or pill. The
 * shared badge is deliberately left alone — Customers, Appointments, Knowledge,
 * and Settings all still render it, and their tables rely on its fixed
 * height for row rhythm.
 *
 * NOTE: this mapping is duplicated from `components/ui/badge.tsx` and
 * `features/dashboard/components/StatusLabel.tsx`. Three copies of one rule set
 * will drift. Consolidating them into a single shared primitive is worth doing,
 * but it would mean editing the dashboard, which this change is scoped out of.
 */
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'text-ink-muted', // gray
  success: 'text-success', // green
  warning: 'text-warning', // orange
  danger: 'text-emergency', // red
  info: 'text-info', // blue
  brand: 'text-accent', // blue
};

export function CallStatusLabel({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const tone: Tone = !value
    ? 'neutral'
    : /EMERGENCY/.test(value)
      ? 'danger'
      : /APPOINTMENT|CONFIRMED|HOT|COMPLETED|PUBLISHED|ACTIVE/.test(value)
        ? 'success'
        : /LEAD|WARM|REQUESTED|HIGH/.test(value)
          ? 'brand'
          : /FAILED|CANCELLED|MISSED|NO_ANSWER/.test(value)
            ? 'warning'
            : 'neutral';
  return (
    <span
      data-slot="call-status-label"
      // Deliberately allowed to compress and wrap, unlike the badge it replaces.
      // The duration column beside it never yields width, so a rigid nowrap
      // label wider than the narrowed name column spills over and prints on top
      // of the timestamp at mobile widths — the old pill did exactly that.
      className={cn('min-w-0 text-caption font-semibold', tones[tone], className)}
    >
      {value ? humanizeEnum(value) : '—'}
    </span>
  );
}
