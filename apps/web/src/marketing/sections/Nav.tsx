import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Brand';
import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { transition } from '../motion';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#product', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
] as const;

/** Section ids in document order, for the scroll-spy. */
const SECTION_IDS = LINKS.map((link) => link.href.slice(1));

/**
 * Tracks which section the reader is currently in.
 *
 * Uses one IntersectionObserver over a horizontal band in the upper third of
 * the viewport rather than scroll maths, so it costs nothing per frame.
 */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}

/**
 * Transparent over the hero, then a blurred hairline-separated bar once the
 * page moves. The chrome appears only when there is content behind it to
 * separate from.
 */
export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection();
  const reduced = useReducedMotion();

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));

  return (
    <header
      className={cn(
        // Positioning belongs to `MarketingHeader`, which pins the whole
        // announcement-bar-plus-navigation stack to the top of the viewport.
        'relative transition-[background-color,border-color,backdrop-filter] duration-300 ease-smooth',
        scrolled
          ? 'border-b border-mk-line bg-black/70 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-6">
          <Link
            to="/"
            className="rounded-md text-white transition-opacity duration-200 ease-smooth hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            <Logo size="sm" />
            <span className="sr-only">rooferslabs home</span>
          </Link>

          <nav
            aria-label="Sections"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
          >
            {LINKS.map((link) => {
              const isActive = active === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'relative rounded-md px-3 py-2 text-[13.5px] transition-colors duration-200 ease-smooth',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring',
                    isActive ? 'text-white' : 'text-white/70 hover:text-white',
                  )}
                >
                  {link.label}
                  {isActive && (
                    // One underline travels between links rather than three
                    // fading in and out.
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-3 -bottom-px h-px bg-mk-accent-fg"
                      transition={reduced ? { duration: 0 } : transition.base}
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Kept at every width: the section links can fold away on a phone
                because the page scrolls, but an existing customer trying to log
                in from their truck cannot. */}
            <Link
              to="/sign-in"
              className="rounded-md px-2 py-2 text-[13.5px] text-white/70 transition-colors duration-200 ease-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring sm:px-3"
            >
              Sign in
            </Link>
            <Button href="/sign-up">Get started</Button>
          </div>
        </div>
      </Container>
    </header>
  );
}
