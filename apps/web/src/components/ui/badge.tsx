import { cn, humanizeEnum } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

// Color is never the only signal: every tone pairs a tint fill with a matching
// border + text hue (the calling context supplies the label/icon).
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-muted border-line',
  success: 'bg-success-subtle text-success border-success-border',
  warning: 'bg-warning-subtle text-warning border-warning-border',
  danger: 'bg-emergency-subtle text-emergency border-emergency-border',
  info: 'bg-info-subtle text-info border-info-border',
  brand: 'bg-accent-subtle text-accent border-accent-border',
};

export function Badge({
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
      data-slot="badge"
      className={cn(
        'inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-caption font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge for a conversation outcome / status enum with a sensible tone. */
export function EnumBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <Badge>—</Badge>;
  const tone: Tone = /EMERGENCY/.test(value)
    ? 'danger'
    : /APPOINTMENT|CONFIRMED|HOT|COMPLETED|PUBLISHED|ACTIVE/.test(value)
      ? 'success'
      : /LEAD|WARM|REQUESTED|HIGH/.test(value)
        ? 'brand'
        : /FAILED|CANCELLED|MISSED|NO_ANSWER/.test(value)
          ? 'warning'
          : 'neutral';
  return <Badge tone={tone}>{humanizeEnum(value)}</Badge>;
}
