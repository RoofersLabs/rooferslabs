import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config';
import { ApiError, setTokenGetter } from '@/lib/api-client';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-lg rounded border border-gray-200 bg-white p-8">
        <h1 className="text-xl font-bold">Configuration required</h1>
        <p className="mt-3 text-sm text-gray-600">
          The app can’t start until these environment variables in{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5">apps/web/.env</code> are fixed, then
          restart the dev server:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-gray-600">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (config.configErrors.length > 0) {
    return <ConfigError errors={config.configErrors} />;
  }

  return (
    <ErrorBoundary>
      <ClerkProvider publishableKey={config.clerkPublishableKey} afterSignOutUrl="/">
        <QueryClientProvider client={queryClient}>
          <TokenBridge>
            <BrowserRouter>{children}</BrowserRouter>
          </TokenBridge>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
