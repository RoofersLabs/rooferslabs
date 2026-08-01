/**
 * The public legal and trust pages.
 *
 * Deliberately not in `auth/stages.ts` ROUTES. That object types
 * `GuardedRoute` as every key except `marketing`, and its access table is a
 * total record over that type — adding a path there would demand a stage list
 * for a page that has no audience restriction at all, and the honest value
 * ("everyone, signed in or not") is not one the table can express. These are
 * public in the same way `/` is public, so they live beside it.
 */
export const MARKETING_ROUTES = {
  home: '/',
  terms: '/terms',
  privacy: '/privacy',
  refunds: '/refunds',
  contact: '/contact',
} as const;

/**
 * An in-page section link that also works from a page that has no such section.
 *
 * The navigation and the announcement bar point at `#pricing` and friends,
 * which resolve against whatever document is loaded. On the home page that is
 * a scroll; on `/terms` it is a no-op, because there is no pricing section to
 * scroll to. Prefixing with the home path on any other route turns it back
 * into a real destination.
 *
 * The home page keeps the bare fragment on purpose: a bare `#pricing` scrolls
 * without touching the router, while `/#pricing` from `/` would be a
 * navigation to the route already mounted.
 */
export function sectionHref(fragment: `#${string}`, pathname: string): string {
  return pathname === MARKETING_ROUTES.home ? fragment : `${MARKETING_ROUTES.home}${fragment}`;
}
