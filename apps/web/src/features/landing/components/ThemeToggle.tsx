import { Moon, Sun } from 'lucide-react';
import type { MarketingTheme } from '../useMarketingTheme';

/**
 * Landing-page theme switch. Controls `data-mkt-theme` only — it has no effect
 * on the authenticated app, which is light-only by design.
 */
export function ThemeToggle({ theme, onToggle }: { theme: MarketingTheme; onToggle: () => void }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="mkt-focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
