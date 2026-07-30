import { SetMetadata } from '@nestjs/common';
import {
  ALLOW_INACTIVE_SUBSCRIPTION_KEY,
  ALLOW_NO_COMPANY_KEY,
  IS_LAUNCH_EXEMPT_KEY,
  IS_PUBLIC_KEY,
} from '../constants';

/** Marks an endpoint as publicly accessible (skips the Clerk auth guard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Allows an authenticated user without a company to reach the endpoint. Used by
 * the auth "me"/"sync" and company-creation endpoints during onboarding, before
 * a tenant exists.
 */
export const AllowNoCompany = () => SetMetadata(ALLOW_NO_COMPANY_KEY, true);

/**
 * Allows an authenticated user whose tenant has no active subscription to reach
 * the endpoint. Reserved for the billing surface itself (checkout, portal,
 * subscription state) — every other tenant-scoped endpoint stays gated.
 */
export const AllowInactiveSubscription = () => SetMetadata(ALLOW_INACTIVE_SUBSCRIPTION_KEY, true);

/**
 * Exempts an endpoint from the private-beta launch gate WITHOUT making it
 * public — the caller must still authenticate.
 *
 * Exists for exactly one route: the launch-access check the SPA calls to decide
 * whether to render the application or the launch page. Applying it anywhere
 * else opens an authenticated hole in the beta, so treat a second usage as a
 * design error rather than a convenience.
 */
export const LaunchGateExempt = () => SetMetadata(IS_LAUNCH_EXEMPT_KEY, true);
