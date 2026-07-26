import type { LucideIcon } from 'lucide-react';
import { Button } from './button';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <h3 className="text-h5 text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-body leading-6 text-ink-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-5" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
