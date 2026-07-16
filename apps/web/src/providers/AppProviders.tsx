import { useEffect, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config';
import { ApiError, setTokenGetter } from '@/lib/api-client';

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

/** Wires Clerk's session token into the API client once auth is ready. */
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      setTokenGetter(() => getToken());
    }
  }, [isLoaded, getToken]);

  if (!isLoaded) return null;
  return <>{children}</>;
}

/** Shown when the Clerk publishable key has not been configured yet. */
function MissingClerkConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-slate-100">
        <h1 className="text-xl font-bold">Authentication is not configured</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Set <code className="rounded bg-slate-800 px-1.5 py-0.5">VITE_CLERK_PUBLISHABLE_KEY</code>{' '}
          in <code className="rounded bg-slate-800 px-1.5 py-0.5">apps/web/.env</code> with your
          Clerk publishable key (Clerk Dashboard → API Keys), then restart the dev server.
        </p>
      </div>
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (!config.clerkPublishableKey) {
    return <MissingClerkConfig />;
  }

  return (
    <ClerkProvider publishableKey={config.clerkPublishableKey} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <TokenBridge>
          <BrowserRouter>{children}</BrowserRouter>
        </TokenBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
