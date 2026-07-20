import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MktLinkButton } from '../components/MktButton';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo } from '../components/Logo';
import type { MarketingTheme } from '../useMarketingTheme';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#integrations', label: 'Integrations' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

/**
 * Marketing navigation.
 *
 * Transparent at rest so the hero reads as one uninterrupted field, and
 * densifying into blurred glass with a single hairline once the page moves.
 * There is exactly one prominent control in the bar — "Start free trial";
 * everything else is a quiet label, which is what keeps an 80px bar from
 * feeling heavy.
 */
export function Navbar({
  theme,
  onToggleTheme,
}: {
  theme: MarketingTheme;
  onToggleTheme: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Glass only kicks in once the page has moved — a bordered bar over the hero
  // at rest cuts the headline off from the space above it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock the page while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors duration-300 ease-out',
        scrolled ? 'mkt-nav-glass' : 'border-b border-transparent',
      )}
    >
      <nav
        className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-6 lg:px-8"
        aria-label="Main"
      >
        <Link
          to="/"
          className="mkt-focus-ring flex shrink-0 items-center gap-2.5 rounded-lg"
          aria-label="RoofersLabs home"
        >
          <Logo className="h-7 w-7" />
          <span className="text-[0.9375rem] font-semibold tracking-tight text-mkt-ink">
            RoofersLabs
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="mkt-focus-ring rounded-full px-4 py-2 text-sm text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Link
            to="/sign-in"
            className="mkt-focus-ring hidden rounded-full px-4 py-2 text-sm text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink sm:block"
          >
            Log in
          </Link>
          <MktLinkButton to="/sign-up" size="sm" className="hidden sm:inline-flex">
            Start free trial
          </MktLinkButton>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="mkt-focus-ring -mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink lg:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-nav" className="mkt-nav-glass border-t border-mkt-line-subtle lg:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col px-6 py-4">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="mkt-focus-ring block rounded-lg py-3 text-[0.9375rem] text-mkt-ink-body transition-colors duration-200 hover:text-mkt-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-4 flex flex-col gap-3 border-t border-mkt-line-subtle pt-5">
              <MktLinkButton to="/sign-in" variant="secondary" size="md">
                Log in
              </MktLinkButton>
              <MktLinkButton to="/sign-up" size="md">
                Start free trial
              </MktLinkButton>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
