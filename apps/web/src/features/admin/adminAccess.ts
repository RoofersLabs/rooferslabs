import { PlatformRole } from '@rooferslabs/shared';

/**
 * What the portal's front door should render.
 *
 * Extracted from the component so the ordering can be asserted rather than
 * trusted. The order is the whole point: every state that is not a definite
 * grant must resolve before anything renders, or the portal flashes a wrong
 * page on the way to the right one.
 */
export type AdminAccess =
  /** Identity is still resolving — show the branded hold, never a page. */
  | 'loading'
  /** No session: send them to sign in, carrying the destination. */
  | 'sign-in'
  /** The session request failed. Not a refusal — do not say "denied". */
  | 'error'
  /** Authenticated, but not staff. A terminus, not a redirect. */
  | 'denied'
  | 'granted';

export interface AdminAccessFacts {
  clerkLoaded: boolean;
  signedIn: boolean;
  /** True while `/auth/me` is in flight. */
  sessionLoading: boolean;
  sessionFailed: boolean;
  /** From the session. Anything other than platform OWNER is refused. */
  platformRole: PlatformRole | undefined;
}

export function resolveAdminAccess({
  clerkLoaded,
  signedIn,
  sessionLoading,
  sessionFailed,
  platformRole,
}: AdminAccessFacts): AdminAccess {
  if (!clerkLoaded) return 'loading';
  if (!signedIn) return 'sign-in';
  if (sessionLoading) return 'loading';
  if (sessionFailed) return 'error';
  return platformRole === PlatformRole.OWNER ? 'granted' : 'denied';
}
