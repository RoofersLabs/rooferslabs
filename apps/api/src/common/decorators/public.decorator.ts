import { SetMetadata } from '@nestjs/common';
import { CompanyStatus } from '@rooferslabs/shared';
import {
  ALLOW_INACTIVE_SUBSCRIPTION_KEY,
  ALLOW_NO_COMPANY_KEY,
  ALLOW_UNAPPROVED_ACCOUNT_KEY,
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
 * Admits a tenant in one of the named statuses to an endpoint that
 * `AccountStatusGuard` would otherwise refuse.
 *
 * Reserved for the guided setup wizard, which necessarily runs *before* a tenant
 * can be approved: without this a company could be created and then never
 * configured, because every write the wizard makes would be refused by the very
 * gate that setup exists to reach.
 *
 * The exemption names statuses rather than being a boolean, and defaults to
 * `ONBOARDING` alone, because those are two very different permissions. "Let a
 * tenant still in setup finish setting up" is the wizard's requirement; "let a
 * paused tenant keep editing its business hours" is not, and a boolean would
 * have granted both. A caller that genuinely needs more says which — and says it
 * in a diff a reviewer can see.
 *
 * It is an exemption from the *account-status* check and nothing else. Tenant
 * isolation, roles and the payment wall all still apply, and the endpoints that
 * carry this are listed one at a time rather than applied to a whole controller
 * — an exemption granted by class is an exemption nobody reviews again.
 */
export const AllowUnapprovedAccount = (...statuses: CompanyStatus[]) =>
  SetMetadata<string, readonly CompanyStatus[]>(
    ALLOW_UNAPPROVED_ACCOUNT_KEY,
    statuses.length ? statuses : [CompanyStatus.ONBOARDING],
  );
