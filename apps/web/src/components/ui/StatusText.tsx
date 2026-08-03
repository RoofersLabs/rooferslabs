import { cn, humanizeEnum } from '@/lib/utils';

/**
 * Flat status indicator: bare colored text, no fill, border or pill.
 *
 * Used by the pages refined to match the dashboard (Customers, Appointments,
 * Knowledge Base, Notifications). The shared `EnumBadge` is deliberately left
 * in place — Calls' detail view and Settings still render it, and
 * their layouts rely on its fixed height.
 *
 * NOTE: the tone rules below are a third copy, after `components/ui/badge.tsx`
 * and `features/dashboard/components/StatusLabel.tsx`, with a fourth in
 * `features/calls/CallStatusLabel.tsx`. Four copies of one rule set will drift,
 * and a status that is orange on one page and gray on another is exactly the
 * bug that produces. Collapsing them into this file is a small change, but it
 * edits the dashboard and Calls, which every one of these passes has scoped
 * out.
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

// Enum values are UPPER_SNAKE, so matching whole `_`-separated words is both
// exact and cheap. `EnumBadge` tests substrings instead, which is why `ACTIVE`
// matches inside `INACTIVE` there and paints a deactivated customer green — the
// opposite of what the status means. Splitting fixes that without disturbing
// any other value; `\b` cannot, because `_` is itself a word character and so
// would break `HOT_LEAD` and `APPOINTMENT_REQUESTED`.
const DANGER = new Set(['EMERGENCY']);
const SUCCESS = new Set(['APPOINTMENT', 'CONFIRMED', 'HOT', 'COMPLETED', 'PUBLISHED', 'ACTIVE']);
const BRAND = new Set(['LEAD', 'WARM', 'REQUESTED', 'HIGH']);
const WARNING = new Set(['FAILED', 'CANCELLED', 'MISSED', 'ANSWER']); // ANSWER ⇐ NO_ANSWER

/** Tones match `EnumBadge`, and the precedence order below is its order. */
export function toneFor(value: string): Tone {
  const words = value.toUpperCase().split('_');
  const has = (set: Set<string>) => words.some((word) => set.has(word));
  return has(DANGER)
    ? 'danger'
    : has(SUCCESS)
      ? 'success'
      : has(BRAND)
        ? 'brand'
        : has(WARNING)
          ? 'warning'
          : 'neutral';
}

/**
 * Deliberately allowed to compress and wrap. A rigid nowrap label sitting next
 * to a column that never yields width prints on top of it at narrow viewports —
 * the behaviour the Calls page's pill had before it was replaced.
 */
export function StatusText({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="status-text"
      className={cn('min-w-0 text-caption font-semibold', tones[tone], className)}
    >
      {children}
    </span>
  );
}

/** Status/outcome enum as flat colored text, tones matching `EnumBadge`. */
export function EnumStatusText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return <StatusText className={className}>—</StatusText>;
  return (
    <StatusText tone={toneFor(value)} className={className}>
      {humanizeEnum(value)}
    </StatusText>
  );
}
