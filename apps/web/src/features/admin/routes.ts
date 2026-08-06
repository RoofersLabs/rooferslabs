/**
 * The portal's paths, named once.
 *
 * Mounted under the customer app's router rather than in a second SPA: the
 * portal reuses the entire design system, api client and auth stack, and a
 * separate bundle would have meant a second copy of all three. The chunk is
 * lazy-loaded, so a customer never downloads it, and the API refuses the data
 * regardless of what any browser asks for.
 *
 * `root` and `companies` are the same page. Managing companies is what this
 * tool is for, so it is the landing surface rather than something reached
 * through a summary screen.
 */
export const ADMIN_ROUTES = {
  root: '/admin',
  companies: '/admin',
  company: (id: string) => `/admin/companies/${id}`,
  /**
   * The approval queue. Its own page rather than a filter on the companies
   * list: approving is a decision, not a way of browsing, and it needs summary
   * counts, per-row actions and a detail drawer that the read-only list has no
   * use for.
   */
  approvals: '/admin/approvals',
  analytics: '/admin/analytics',
  settings: '/admin/settings',
} as const;
