/**
 * Which surface of the product this browser tab is.
 *
 * One build serves two hostnames. The apex and www are the marketing site plus
 * the customer application; `admin.<domain>` is the internal portal. Nothing
 * here is a security control — it decides what to *show*. Who may read admin
 * data is settled server-side by `PlatformAdminGuard`, which does not care what
 * hostname asked.
 */
export type AppSurface = 'customer' | 'admin';

/**
 * Any host whose first label is `admin` is the portal.
 *
 * Matching the label rather than the full string keeps this working across the
 * environments the app runs in — `admin.rooferslabs.com`, a staging apex, a
 * preview host — without a list of literals to keep in step with Terraform.
 */
export function surfaceForHost(hostname: string | undefined | null): AppSurface {
  if (!hostname) return 'customer';
  const [label] = hostname.toLowerCase().trim().split('.');
  return label === 'admin' ? 'admin' : 'customer';
}

/** The surface this document is being served as. */
export function currentSurface(): AppSurface {
  if (typeof window === 'undefined') return 'customer';
  return surfaceForHost(window.location.hostname);
}
