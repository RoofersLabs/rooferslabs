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

export function Navbar({ theme, onToggleTheme }: { theme: MarketingTheme; onToggleTheme: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // Glass only kicks in once the page has moved — a bordered bar over the hero
  // at rest cuts the headline off from the atmosphere behind it.
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
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'mkt-glass-raised' : 'border-b border-transparent',
      )}
    >
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6"
        aria-label="Main"
      >
        <Link
          to="/"
          className="mkt-focus-ring flex shrink-0 items-center gap-2.5 rounded-lg"
          aria-label="RoofersLabs home"
        >
          <Logo />
          <span className="text-[0.9375rem] font-semibold tracking-tight text-mkt-ink">
            RoofersLabs
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="mkt-focus-ring rounded-lg px-3 py-2 text-sm text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink"
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
            className="mkt-focus-ring hidden rounded-lg px-3 py-2 text-sm text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink sm:block"
          >
            Log in
          </Link>
          <MktLinkButton to="#demo" variant="secondary" size="sm" className="hidden sm:inline-flex">
            Book a demo
          </MktLinkButton>
          <MktLinkButton to="/sign-up" size="sm" className="hidden sm:inline-flex">
            Start free trial
          </MktLinkButton>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="mkt-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-mkt-line text-mkt-ink-muted lg:hidden"
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="mkt-glass border-t border-mkt-line-subtle lg:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="mkt-focus-ring block rounded-lg px-3 py-2.5 text-[0.9375rem] text-mkt-ink-body hover:bg-mkt-accent-soft"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex flex-col gap-2 border-t border-mkt-line-subtle pt-4">
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
