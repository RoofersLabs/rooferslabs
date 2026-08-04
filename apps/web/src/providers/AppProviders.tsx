import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config';
import { ApiError, setTokenGetter } from '@/lib/api-client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error) => {
        // Never retry auth/permission failures; retry transient errors once.
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Wires Clerk's session token into the API client once auth is ready. The
 * getter is installed during render (idempotent), not in an effect: child
 * effects run before parent effects, so an effect here would let the first
 * child queries fire without a token.
 */
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  if (isLoaded) {
    setTokenGetter(() => getToken());
  }

  if (!isLoaded) return null;
  return <>{children}</>;
}

/** Shown when required frontend environment variables are missing or invalid. */
function ConfigError({ errors }: { errors: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <Card className="max-w-lg px-8 py-8">
        <IconTile icon={WrenchScrewdriverIcon} tone="warning" size="xl" />
        <h1 className="mt-5 text-h4 text-ink">Configuration required</h1>
        <p className="mt-1.5 text-body leading-6 text-ink-muted">
          The app can’t start until these environment variables in{' '}
          <code className="font-num bg-surface-3 px-1.5 py-0.5 text-small text-ink">
            apps/web/.env
          </code>{' '}
          are fixed. Correct them, then restart the dev server:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-small text-ink-muted">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/**
 * Everything every route needs: an error boundary and a router.
 *
 * Auth deliberately does *not* live here. The public marketing site is a route
 * like any other, and mounting Clerk above it would make a page with no session
 * wait on an auth SDK before it can paint — and take the whole site down with
 * it whenever the key is wrong for the environment.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <BrowserRouter>{children}</BrowserRouter>
    </ErrorBoundary>
  );
}

/**
 * Wraps the authenticated area. Mounted by the route tree beneath the public
 * surface, so configuration problems surface where they matter instead of
 * blanking the marketing site.
 */
export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  if (config.configErrors.length > 0) {
    return <ConfigError errors={config.configErrors} />;
  }

  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <TokenBridge>{children}</TokenBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
