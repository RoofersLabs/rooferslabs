/** Metadata keys and shared constants used across the backend. */

/** Route decorator key marking an endpoint as public (skips authentication). */
export const IS_PUBLIC_KEY = 'isPublic';

/** Route decorator key carrying the roles allowed to access an endpoint. */
export const ROLES_KEY = 'roles';

/** Route decorator key marking an endpoint as not requiring a company yet. */
export const ALLOW_NO_COMPANY_KEY = 'allowNoCompany';

/** Route decorator key marking an endpoint as reachable without active billing. */
export const ALLOW_INACTIVE_SUBSCRIPTION_KEY = 'allowInactiveSubscription';

/**
 * Route decorator key marking an endpoint as exempt from the private-beta gate
 * while still requiring authentication.
 *
 * Reserved for the one endpoint the launch page needs in order to decide what
 * to render: "is the signed-in caller allowed in?". Everything else that is
 * gated stays gated — an exemption here is an authenticated hole in the beta.
 */
export const IS_LAUNCH_EXEMPT_KEY = 'isLaunchExempt';

/** Header used to correlate a request across logs and the response envelope. */
export const REQUEST_ID_HEADER = 'x-request-id';
