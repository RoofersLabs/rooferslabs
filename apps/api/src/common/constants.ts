/** Metadata keys and shared constants used across the backend. */

/** Route decorator key marking an endpoint as public (skips authentication). */
export const IS_PUBLIC_KEY = 'isPublic';

/** Route decorator key carrying the roles allowed to access an endpoint. */
export const ROLES_KEY = 'roles';

/** Route decorator key marking an endpoint as not requiring a company yet. */
export const ALLOW_NO_COMPANY_KEY = 'allowNoCompany';

/** Header used to correlate a request across logs and the response envelope. */
export const REQUEST_ID_HEADER = 'x-request-id';
