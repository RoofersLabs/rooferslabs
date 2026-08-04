import { Button } from './button';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ICON_SIZE } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Inline failure state for panels and lists — the counterpart of EmptyState,
 * so a failed query is never mistaken for "no data".
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <ExclamationTriangleIcon className={cn('mb-3 text-emergency', ICON_SIZE.empty)} aria-hidden />
      <h3 className="text-h5 text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-body leading-6 text-ink-muted">
        {message || 'Please try again in a moment.'}
      </p>
      {onRetry && (
        <Button className="mt-5" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
