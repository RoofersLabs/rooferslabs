import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logomark } from '../components/icons';
import { Cta, Shell } from '../components/primitives';
import { useScrollOffset } from '../lib/hooks';

const LINKS = [
  { label: 'Product', href: '#showcase' },
  { label: 'AI Receptionist', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#resources' },
  { label: 'Company', href: '#company' },
];

/**
 * Fixed navigation, 72px tall.
 *
 * Completely transparent and borderless at rest — the hero reads as one
 * uninterrupted plane, and a bar drawn over nothing is just noise. The blur and
 * hairline appear only once content is actually passing underneath, at which
 * point they are separating two things rather than decorating one.
 *
 * The threshold is 8px, not 0: a trackpad's inertial overscroll can register a
 * pixel or two of scroll at rest, and a navbar that flickers its background on
 * an untouched page is the kind of detail nobody reports but everybody feels.
 */
export function Nav({ signedIn }: { signedIn: boolean }) {
  const scrolled = useScrollOffset() > 8;
  const [menuOpen, setMenuOpen] = useState(false);

  // A menu left open through a resize into desktop layout strands the page with
  // an invisible expanded panel.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50',
        // Only the three properties that actually change. `transition: all`
        // here would also animate the layout on first paint.
        'transition-[background-color,border-color,backdrop-filter] duration-300 ease-out',
        scrolled
          ? 'border-b border-subtle bg-void/60 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Shell>
        <div className="flex h-[72px] items-center justify-between gap-8">
          <Link
            to="/"
            className="pressable flex shrink-0 items-center gap-2 text-[0.9375rem] font-semibold tracking-tight"
          >
            <Logomark className="text-ink" />
            RoofersLabs
          </Link>

          {/* Centred independently of the logo and actions, so the link group
              sits on the page's optical centre rather than wherever the two
              side clusters happen to leave room. */}
          <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 xl:block">
            <ul className="flex items-center gap-0.5">
              {LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="whitespace-nowrap rounded-md px-3 py-2 text-[0.8125rem] text-ink-secondary transition-colors duration-150 ease-out hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
            {signedIn ? (
              <Cta to="/dashboard" size="sm" variant="inverse">
                Go to dashboard
              </Cta>
            ) : (
              <>
                <Link
                  to="/sign-in"
                  className="pressable rounded-md px-3 py-2 text-[0.8125rem] text-ink-secondary transition-colors duration-150 ease-out hover:text-ink"
                >
                  Sign in
                </Link>
                <Cta to="/sign-up" size="sm" variant="inverse">
                  Start free trial
                </Cta>
              </>
            )}
          </div>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
            className="pressable -mr-2 flex h-10 w-10 items-center justify-center rounded-md text-ink xl:hidden"
          >
            {/* Two rules that rotate into a cross. Rotating the existing
                strokes reads as one object changing state; swapping a
                hamburger glyph for an X glyph reads as two icons. */}
            <span className="relative block h-4 w-[18px]" aria-hidden="true">
              <span
                className={cn(
                  'absolute left-0 block h-px w-[18px] bg-current transition-transform duration-200 ease-out',
                  menuOpen ? 'top-2 rotate-45' : 'top-1',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 block h-px w-[18px] bg-current transition-transform duration-200 ease-out',
                  menuOpen ? 'top-2 -rotate-45' : 'top-3',
                )}
              />
            </span>
          </button>
        </div>
      </Shell>

      {/* Animating grid-template-rows from 0fr to 1fr reaches the panel's real
          height without measuring anything in JavaScript, so it stays correct
          at any width and with any link count. */}
      <div
        id="mobile-nav"
        className={cn(
          'grid overflow-hidden border-subtle bg-void/95 backdrop-blur-xl transition-[grid-template-rows,border-color] duration-300 ease-out xl:hidden',
          menuOpen ? 'grid-rows-[1fr] border-b' : 'grid-rows-[0fr] border-b-0',
        )}
      >
        <div className="min-h-0">
          <Shell className="pb-6 pt-2">
            <nav aria-label="Mobile">
              <ul className="space-y-0.5">
                {LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-md px-2 py-2.5 text-[0.9375rem] text-ink-secondary hover:text-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              {signedIn ? (
                <Cta to="/dashboard" variant="inverse">
                  Go to dashboard
                </Cta>
              ) : (
                <>
                  <Cta to="/sign-up" variant="inverse">
                    Start free trial
                  </Cta>
                  <Cta to="/sign-in" variant="secondary">
                    Sign in
                  </Cta>
                </>
              )}
            </div>
          </Shell>
        </div>
      </div>
    </header>
  );
}
