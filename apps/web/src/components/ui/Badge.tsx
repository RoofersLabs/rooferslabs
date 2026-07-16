import { cn, humanizeEnum } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  brand: 'bg-brand-100 text-brand-800',
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
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
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
