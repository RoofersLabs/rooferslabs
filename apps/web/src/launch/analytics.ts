/**
 * Launch-page analytics.
 *
 * The four events the pre-launch period is measured by:
 *
 *   launch_page_viewed        someone reached the gate
 *   early_access_requested    a lead was captured
 *   internal_login            an allowlisted account got in
 *   access_denied             a signed-in account was turned away
 *
 * The last two are ALSO emitted server-side by LaunchGateGuard, which is the
 * authoritative record — a browser event can be blocked, spoofed, or simply
 * never fire. These client events exist to line the funnel up with page views;
 * they are never the source of truth for who accessed what.
 *
 * Deliberately provider-agnostic. No analytics vendor is wired into this
 * application yet, and picking one is not part of a launch-gate change. This
 * pushes to `window.dataLayer` — the convention every major tag manager and
 * product-analytics snippet already consumes — so adding a provider later is a
 * script tag rather than an edit to every call site.
 */

export type LaunchEvent =
  'launch_page_viewed' | 'early_access_requested' | 'internal_login' | 'access_denied';

interface DataLayerWindow extends Window {
  dataLayer?: Array<Record<string, unknown>>;
}

export function trackLaunchEvent(event: LaunchEvent, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const target = window as DataLayerWindow;
  target.dataLayer = target.dataLayer ?? [];
  target.dataLayer.push({
    event: `launch.${event}`,
    ...detail,
    // Client clocks are unreliable, so this is a correlation aid for lining up
    // with server logs, not an authoritative timestamp.
    occurredAt: new Date().toISOString(),
  });
}
