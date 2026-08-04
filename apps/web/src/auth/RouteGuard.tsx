import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { FullScreenSpinner } from '@/components/ui/spinner';
import { useAccess } from './AccessProvider';
import { redirectFor, type GuardedRoute } from './stages';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/** The session request failed — routing cannot be decided, so offer a retry. */
function SessionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <Card className="max-w-md items-center px-8 py-10 text-center">
        <IconTile icon={ExclamationTriangleIcon} tone="emergency" size="xl" />
        <h1 className="mt-5 text-h4 text-ink">We couldn’t load your workspace</h1>
        <p className="mt-1.5 max-w-sm text-body leading-6 text-ink-muted">
          {message || 'Please try again in a moment.'}
        </p>
        <Button className="mt-6" onClick={onRetry}>
          Retry
        </Button>
      </Card>
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

  if (access.isLoading) return <FullScreenSpinner label="Loading your workspace…" />;

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
