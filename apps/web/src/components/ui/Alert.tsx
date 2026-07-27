import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'danger';

/** Each tone pairs its tint and border with a distinct icon, never colour alone. */
const tones: Record<Tone, { surface: string; icon: LucideIcon; iconColor: string }> = {
  info: {
    surface: 'border-info-border bg-info-subtle',
    icon: Info,
    iconColor: 'text-info',
  },
  success: {
    surface: 'border-success-border bg-success-subtle',
    icon: CheckCircle2,
    iconColor: 'text-success',
  },
  warning: {
    surface: 'border-warning-border bg-warning-subtle',
    icon: AlertTriangle,
    iconColor: 'text-warning',
  },
  danger: {
    surface: 'border-emergency-border bg-emergency-subtle',
    icon: ShieldAlert,
    iconColor: 'text-emergency',
  },
};

/**
 * An inline notice: a tinted, bordered strip with a leading status icon.
 *
 * Billing, checkout and the wizard each grew their own version of this from raw
 * blue/yellow/red utilities. One component now owns the shape, so a warning
 * looks the same wherever it appears — and always carries an icon, so the
 * message is not conveyed by colour alone.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { surface, icon: Icon, iconColor } = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3.5', surface, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="text-body font-semibold text-ink">{title}</p>}
        {children && (
          <div className={cn('text-small text-ink-muted', title && 'mt-0.5')}>{children}</div>
        )}
      </div>
    </div>
  );
}
