import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAccess } from './AccessProvider';
import { redirectFor, type GuardedRoute } from './stages';

function FullPageMessage({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
      {label}
    </div>
  );
}

/** The session request failed — routing cannot be decided, so offer a retry. */
function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-bold">We couldn’t load your workspace</h1>
      <p className="mt-2 text-sm text-gray-600">{message || 'Please try again in a moment.'}</p>
      <button
        type="button"
        className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

/**
 * The only component in the application that redirects.
 *
 * It is a layout route: every guarded path is nested under one of these, naming
 * the route it protects. Who may view that route is read from the access table
 * on the context, so a route's audience can depend on runtime configuration
 * (such as whether payments are enabled) without the guard growing a special
 * case. The decision itself lives in `redirectFor`, which is pure and proven
 * acyclic, so this component only renders the outcome.
 */
export function RouteGuard({ route }: { route: GuardedRoute }) {
  const access = useAccess();
  const location = useLocation();

  if (access.isLoading) return <FullPageMessage label="Loading your workspace…" />;

  // A signed-in visitor whose session will not load has no derivable stage.
  // Anonymous visitors are unaffected — their stage needs no session.
  if (access.error && access.stage !== 'anonymous') {
    return <SessionError message={access.error.message} onRetry={access.retry} />;
  }

  const destination = redirectFor(access.stage, access.access[route], access.access);
  if (destination) {
    // Remember where they were headed so sign-in can return them there.
    const state = access.stage === 'anonymous' ? { from: location.pathname } : undefined;
    return <Navigate to={destination} replace state={state} />;
  }

  return <Outlet />;
}
