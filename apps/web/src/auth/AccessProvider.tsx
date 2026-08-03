import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { OnboardingStep } from '@rooferslabs/shared';
import { useSessionQuery } from '@/hooks/queries';
import type { SessionCompany, SessionUser } from '@/types/api';
import { resolveStage, routeAccess, type RouteAccess, type Stage } from './stages';

export interface AccessState {
  stage: Stage;
  /** The signed-in user. Null until the session resolves. */
  user: SessionUser | null;
  /** The caller's tenant. Null until it is created in wizard step 1. */
  company: SessionCompany | null;
  /** Null until the tenant creates its company in wizard step 1. */
  onboardingStep: OnboardingStep | null;
  /** Which stages may view each route. */
  access: RouteAccess;
  /** True while Clerk or the session request is still resolving. */
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

const AccessContext = createContext<AccessState | null>(null);

/**
 * Reads the session exactly once for the whole authenticated area and derives
 * the access stage from it.
 *
 * Having a single subscriber matters: every guard reads the same cached query,
 * so two guards disagreeing about the same session is not representable.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const signedIn = Boolean(isLoaded && isSignedIn);
  const session = useSessionQuery(signedIn);

  const { data, isPending, isError, error, refetch } = session;

  const value = useMemo<AccessState>(() => {
    const company = data?.company ?? null;
    const onboardingStep = company?.onboardingStep ?? null;
    return {
      stage: resolveStage({ isSignedIn: signedIn, onboardingStep }),
      user: data?.user ?? null,
      company,
      onboardingStep,
      access: routeAccess(),
      // Only a signed-in visitor waits on the session; an anonymous one is
      // already fully resolved and must not be held behind a request that
      // will never run.
      isLoading: !isLoaded || (signedIn && isPending),
      error: isError ? (error as Error) : null,
      retry: () => void refetch(),
    };
  }, [isLoaded, signedIn, data, isPending, isError, error, refetch]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('useAccess must be used within <AccessProvider>.');
  }
  return context;
}
