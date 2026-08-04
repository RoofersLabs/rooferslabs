import { LogoMark } from '@/components/Brand';
import { cn } from '@/lib/utils';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export function Spinner({ className }: { className?: string }) {
  return (
    <ArrowPathIcon className={cn('h-5 w-5 animate-spin text-accent', className)} aria-hidden />
  );
}

/**
 * The whole-page wait. The mark carries it rather than a bare spinner: this is
 * the first thing a returning user sees while the session resolves, and an
 * unbranded screen there is the one moment the product looks like nobody's.
 */
export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-base">
      <LogoMark className="h-5 text-brand-950" />
      <div className="flex items-center gap-2.5">
        <Spinner className="h-4 w-4" />
        {label && <p className="text-body text-ink-muted">{label}</p>}
      </div>
    </div>
  );
}

/** Inline loading block for panels and lists. */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-muted">
      <Spinner />
      <span className="text-body">{label}</span>
    </div>
  );
}
