import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

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
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {message || 'Please try again in a moment.'}
      </p>
      {onRetry && (
        <Button className="mt-4" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
