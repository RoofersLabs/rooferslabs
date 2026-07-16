/**
 * Frontend runtime configuration, sourced from Vite env vars.
 * See apps/web/.env.example for setup guidance.
 */
export const config = {
  /** Base URL of the backend API. Empty string → same-origin (Vite proxy in dev). */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
  /** Clerk publishable key (pk_test_… / pk_live_…). */
  clerkPublishableKey: (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? '',
} as const;
