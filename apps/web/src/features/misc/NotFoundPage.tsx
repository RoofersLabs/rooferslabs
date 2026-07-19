import { Link } from 'react-router-dom';
import { ArrowLeft, HardHat } from 'lucide-react';

/** 404 for unknown routes, instead of silently redirecting home. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent shadow-button">
        <HardHat className="h-6 w-6 text-ink-on-brand" aria-hidden />
      </span>
      <p className="font-num mt-8 text-display text-line-strong">404</p>
      <h1 className="-mt-2 text-h3 text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-body text-ink-muted">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link
        to="/dashboard"
        className="focus-ring mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-button font-semibold text-ink-on-brand shadow-button transition-all duration-fast hover:bg-accent-hover active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Go to dashboard
      </Link>
    </div>
  );
}
