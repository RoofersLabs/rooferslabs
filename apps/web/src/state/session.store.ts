import { create } from 'zustand';
import type { Session, SessionCompany, SessionUser, SubscriptionSummary } from '@/types/api';

interface SessionState {
  user: SessionUser | null;
  company: SessionCompany | null;
  subscription: SubscriptionSummary | null;
  /** True once /v1/auth/me has resolved at least once. */
  loaded: boolean;
  setSession: (session: Session) => void;
  setCompany: (company: SessionCompany | null) => void;
  clear: () => void;
}

/**
 * Shared application state for the authenticated session.
 * Server state (queries) lives in TanStack Query; this holds only the
 * bootstrap identity, tenant, and billing state used across layouts and guards.
 */
export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  company: null,
  subscription: null,
  loaded: false,
  setSession: (session) =>
    set({
      user: session.user,
      company: session.company,
      subscription: session.subscription,
      loaded: true,
    }),
  setCompany: (company) => set({ company }),
  clear: () => set({ user: null, company: null, subscription: null, loaded: false }),
}));
