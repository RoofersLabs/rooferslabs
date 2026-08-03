import { cn, humanizeEnum } from '@/lib/utils';

/**
 * The dashboard's flat status indicator.
 *
 * A deliberate dashboard-only counterpart to the shared `EnumBadge`: same
 * semantic tone mapping, but rendered as bare colored text with no fill, no
 * border and no pill. At the density the dashboard runs, a column of tinted
 * capsules reads as decoration competing with the row content it labels —
 * weight and hue carry the meaning on their own.
 *
 * This lives under `features/dashboard/` rather than `components/ui/` because
 * Calls, Customers, Appointments, Knowledge, Settings and Billing all still use
 * the badge form, and their tables depend on its fixed height for row rhythm.
 */
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

// Text-only tones. The hues are the same tokens the badge fills with, so a
// status reads identically here and on the page it links out to.
const tones: Record<Tone, string> = {
  neutral: 'text-ink-muted', // gray
  success: 'text-success', // green
  warning: 'text-warning', // orange
  danger: 'text-emergency', // red
  info: 'text-info', // blue
  brand: 'text-accent', // blue
};

export function StatusLabel({
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
      data-slot="status-label"
      className={cn(
        'w-fit shrink-0 whitespace-nowrap text-caption font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status/outcome enum as flat colored text.
 *
 * The tone rules are kept identical to `EnumBadge` on purpose — a call that is
 * "Missed" must not be orange on the dashboard and gray on the calls page.
 */
export function EnumStatusLabel({
  value,
  className,
}: {
  value: string | null | undefined;
  /** Forwarded so a caller can cap the label inside a fixed-width column. */
  className?: string;
}) {
  if (!value) return <StatusLabel className={className}>—</StatusLabel>;
  const tone: Tone = /EMERGENCY/.test(value)
    ? 'danger'
    : /APPOINTMENT|CONFIRMED|HOT|COMPLETED|PUBLISHED|ACTIVE/.test(value)
      ? 'success'
      : /LEAD|WARM|REQUESTED|HIGH/.test(value)
        ? 'brand'
        : /FAILED|CANCELLED|MISSED|NO_ANSWER/.test(value)
          ? 'warning'
          : 'neutral';
  return (
    <StatusLabel tone={tone} className={className}>
      {humanizeEnum(value)}
    </StatusLabel>
  );
}
