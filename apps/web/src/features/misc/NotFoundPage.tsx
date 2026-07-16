import { Link } from 'react-router-dom';
import { HardHat } from 'lucide-react';

/** 404 for unknown routes, instead of silently redirecting home. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700">
        <HardHat className="h-6 w-6 text-white" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Link
        to="/dashboard"
        className="focus-ring mt-6 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
