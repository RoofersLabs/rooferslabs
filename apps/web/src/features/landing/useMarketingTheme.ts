import { useCallback, useEffect, useState } from 'react';

export type MarketingTheme = 'light' | 'dark';

const STORAGE_KEY = 'rooferslabs:marketing-theme';

function readStored(): MarketingTheme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // Private browsing / storage disabled — fall back to system preference.
    return null;
  }
}

function systemTheme(): MarketingTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light/dark state for the marketing page only.
 *
 * Deliberately NOT wired to the app's `data-theme` attribute: the dashboard is
 * a light-only product surface, and a visitor flipping the landing page to dark
 * must not change what they see after signing in. The value is written to
 * `data-mkt-theme` on the landing root by the caller, which is the single
 * attribute `marketing.css` keys off.
 */
export function useMarketingTheme() {
  // Resolved during the initial render rather than in an effect: this app is a
  // client-only SPA with no SSR pass, so reading storage here is safe and the
  // first paint lands on the correct theme instead of flashing light first.
  const [theme, setTheme] = useState<MarketingTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    return readStored() ?? systemTheme();
  });
  // Colour transitions stay off for the first paint, otherwise restoring a
  // stored dark preference visibly animates from light on every page load.
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Follow the OS only while the visitor hasn't expressed a preference.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!readStored()) setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
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
