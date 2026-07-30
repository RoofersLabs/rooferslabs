import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import type { OnboardingStep } from '@rooferslabs/shared';
import { queryKeys, useSessionQuery } from '@/hooks/queries';
import { onSubscriptionRequired } from '@/lib/api-client';
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
  /**
   * Whether billing is switched on platform-wide, as reported by the API. False
   * hides the payment and billing surfaces entirely.
   */
  paymentsEnabled: boolean;
  /** Which stages may view each route, derived from `paymentsEnabled`. */
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
 * Having a single subscriber matters: the previous implementation read billing
 * state from `/auth/me` in the route guard and from `/billing/subscription` on
 * the payment page, so the two could disagree after checkout and bounce the
 * browser between `/payment` and `/dashboard`. Every guard now reads the same
 * cached query, so a disagreement is not representable.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const signedIn = Boolean(isLoaded && isSignedIn);
  const session = useSessionQuery(signedIn);

  // The API answers 402 on every gated endpoint once a subscription lapses.
  // Refetching the session re-derives the stage, and the guards move the user
  // to /payment on the next render — no full page reload, no lost state.
  useEffect(
    () =>
      onSubscriptionRequired(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      }),
    [queryClient],
  );

  const { data, isPending, isError, error, refetch } = session;

  const value = useMemo<AccessState>(() => {
    const company = data?.company ?? null;
    const onboardingStep = company?.onboardingStep ?? null;
    const isSubscribed = data?.subscription?.isActive ?? false;
    // Default to enabled until the session answers, matching the API's own
    // fail-closed default so a slow response cannot flash the billing surface.
    const paymentsEnabled = data?.paymentsEnabled ?? true;
    return {
      stage: resolveStage({ isSignedIn: signedIn, onboardingStep, isSubscribed, paymentsEnabled }),
      user: data?.user ?? null,
      company,
      onboardingStep,
      paymentsEnabled,
      access: routeAccess(paymentsEnabled),
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
