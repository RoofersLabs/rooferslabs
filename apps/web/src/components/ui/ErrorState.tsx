import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

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
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emergency-subtle text-emergency">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
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
