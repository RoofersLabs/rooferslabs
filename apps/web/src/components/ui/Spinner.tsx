import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-accent', className)} aria-hidden />;
}

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-base">
      <Spinner className="h-8 w-8" />
      {label && <p className="text-body text-ink-muted">{label}</p>}
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
