import { config } from '@/config';
import { api } from '@/lib/api-client';

export type LaunchMode = 'private' | 'public';

// Vite substitutes both of these textually at build time (see `define` in
// vite.config.ts). They are re-declared here, module-scoped, because ts-jest
// compiles with its own inline tsconfig and never sees vite-env.d.ts — without
// this the module type-checks in the app build and fails in tests.
declare const __APP_ENV__: string | undefined;
declare const __APP_LAUNCH_MODE__: string | undefined;

// `typeof` first: under Vite these become `typeof "production"`, and under Jest
// (where neither identifier exists) `typeof` on an undeclared name is the one
// safe way to ask — a bare reference would throw a ReferenceError at import.
const buildEnv = typeof __APP_ENV__ === 'undefined' ? 'development' : __APP_ENV__;
const buildMode = typeof __APP_LAUNCH_MODE__ === 'undefined' ? 'public' : __APP_LAUNCH_MODE__;

/**
 * Build-time fallback, used only when the API cannot be reached.
 *
 * The API is authoritative — see `fetchLaunchMode`. This exists so a boot with
 * a dead API still renders something deliberate rather than a blank page, and
 * so local development is never gated regardless of what any server says.
 *
 * Only a production build that was explicitly told `private` falls back to
 * `private`; everything else falls back to `public`, so a test run or a local
 * build can never accidentally gate itself.
 */
export const BUILD_TIME_LAUNCH_MODE: LaunchMode =
  buildEnv === 'production' && buildMode === 'private' ? 'private' : 'public';

/**
 * Ask the API what the launch state is.
 *
 * Runtime rather than build-time is the whole point: lifting the gate on launch
 * day is an environment variable and a restart of the API, with no frontend
 * rebuild and no redeploy. Baking the mode into the bundle would have made
 * "set APP_LAUNCH_MODE=public" insufficient on its own.
 *
 * On failure this falls back to the build-time value rather than guessing.
 * During the beta that value is `private`, so an API outage leaves the gate
 * shut — the safe direction. Note that this choice only affects what is
 * *rendered*: the API refuses application data to a non-allowlisted caller
 * whatever the browser decides, so a wrong answer here leaks nothing.
 */
export async function fetchLaunchMode(signal?: AbortSignal): Promise<LaunchMode> {
  try {
    const response = await fetch(`${config.apiBaseUrl}/v1/launch/config`, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return BUILD_TIME_LAUNCH_MODE;

    const payload = (await response.json()) as { data?: { mode?: string } };
    const mode = payload?.data?.mode;
    // Only an explicit "public" opens the gate; anything unexpected leaves it
    // as the build said, matching the API's own fail-closed resolution.
    return mode === 'public' ? 'public' : mode === 'private' ? 'private' : BUILD_TIME_LAUNCH_MODE;
  } catch {
    return BUILD_TIME_LAUNCH_MODE;
  }
}

/**
 * Ask the API whether the signed-in caller may enter.
 *
 * Uses the shared api-client so the Clerk bearer token is attached — this is
 * the one launch endpoint that is authenticated. Any failure resolves to
 * `false`: during a private beta, "we could not confirm you are allowed in" and
 * "you are not allowed in" should look the same to the browser, and the API
 * would refuse the underlying data either way.
 */
export async function fetchLaunchAccess(): Promise<boolean> {
  try {
    const result = await api.get<{ allowed: boolean }>('/launch/access');
    return result.allowed === true;
  } catch {
    return false;
  }
}

/**
 * Submit an early-access request.
 *
 * Plain `fetch` rather than the shared api-client: that client attaches a Clerk
 * bearer token and routes 402s into the subscription flow, neither of which
 * applies to an endpoint whose entire purpose is to be usable by someone with
 * no account at all.
 */
export async function submitEarlyAccess(input: {
  name: string;
  company: string;
  email: string;
  phone?: string;
}): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/v1/launch/early-access`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ??
        (response.status === 429
          ? 'Too many requests. Please try again in a minute.'
          : 'Something went wrong. Please try again.'),
    );
  }
}
