import { useCallback, useEffect, useState } from 'react';

export type MarketingTheme = 'light' | 'dark';

const STORAGE_KEY = 'rooferslabs:marketing-theme';

function readStored(): MarketingTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // Private browsing / storage disabled — fall back to the dark default.
    return null;
  }
}

/**
 * Light/dark state for the marketing page only.
 *
 * Deliberately NOT wired to the app's `data-theme` attribute: the dashboard is
 * a light-only product surface, and a visitor flipping the landing page to dark
 * must not change what they see after signing in. The value is written to
 * `data-mkt-theme` on the landing root by the caller, which is the single
 * attribute `marketing.css` keys off.
 *
 * Dark is the default for a first-time visitor, and it does NOT follow the OS:
 * dark is how this page is art-directed, so a visitor on a light desktop should
 * still land on the intended composition. The OS preference only ever governed
 * visitors who had expressed no preference, which is exactly the case this
 * default now owns. A manual choice still wins and still persists.
 */
export function useMarketingTheme() {
  // Resolved during the initial render rather than in an effect: this app is a
  // client-only SPA with no SSR pass, so reading storage here is safe and the
  // first paint lands on the correct theme instead of flashing the other one.
  const [theme, setTheme] = useState<MarketingTheme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return readStored() ?? 'dark';
  });
  // Colour transitions stay off for the first paint, otherwise restoring a
  // stored light preference visibly animates from the dark default on every
  // page load.
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: MarketingTheme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Preference simply won't persist; the toggle still works this session.
      }
      return next;
    });
  }, []);

  return { theme, toggle, animated };
}
