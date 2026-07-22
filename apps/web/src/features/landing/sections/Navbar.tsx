import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Github, Moon, Star, Sun, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { MarketingTheme } from '../useMarketingTheme';

import '../styles/navbar.css';

/**
 * RoofersLabs marketing navbar.
 *
 * A self-contained black identity that never inherits the page theme — all of
 * its styling comes from the `--rl-nav-*` tokens in navbar.css, so the bar reads
 * #000 / #fff whether the rest of the page is light or dark. The visual target
 * is the proportions and interaction quality of the Warp navigation, rebuilt on
 * RoofersLabs tokens rather than copied.
 */

// Top-level nav. Chevrons signal "section" the way Warp's do; hrefs point at the
// nearest existing landing anchor until real dropdown panels are wired up.
const MENU = [
  { label: 'Platform', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', href: '#faq' },
  { label: 'Company', href: '#main' },
];

const GITHUB_URL = 'https://github.com/RoofersLabs';
// Illustrative until wired to the live GitHub API — mirrors how DashboardMock
// uses representative sample figures rather than a placeholder.
const GITHUB_STARS = '1.2k';

/** The RoofersLabs mark, drawn with fixed navbar colours so it can't drift. */
function NavMark() {
  return (
    <span className="rl-nav__mark" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden>
        <path
          d="M3 11.5 12 4l9 7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 15.5a4.5 4.5 0 0 1 7 0"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="12" cy="19" r="1.3" fill="currentColor" />
      </svg>
    </span>
  );
}

function GithubStars() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      className="rl-nav__github"
      aria-label={`RoofersLabs on GitHub — ${GITHUB_STARS} stars`}
    >
      <Github className="rl-nav__github-icon" aria-hidden />
      <span className="rl-nav__github-count">{GITHUB_STARS}</span>
      <Star className="rl-nav__github-star" fill="currentColor" aria-hidden />
    </a>
  );
}

export function Navbar({
  theme,
  onToggleTheme,
}: {
  theme: MarketingTheme;
  onToggleTheme: () => void;
}) {
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The scrolled treatment (blur + hairline) only kicks in once the page moves;
  // at rest the bar is solid black against the hero.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock the page and wire Escape while the mobile sheet is open; restore focus
  // to the trigger when it closes.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const themeLabel = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;

  return (
    <header className="rl-nav" data-scrolled={scrolled} aria-label="Main">
      <nav className="rl-nav__inner">
        {/* Left — brand */}
        <div className="rl-nav__cluster">
          <Link to="/" className="rl-nav__brand" aria-label="RoofersLabs home">
            <NavMark />
            <span className="rl-nav__wordmark">RoofersLabs</span>
          </Link>
        </div>

        {/* Center — menu */}
        <ul className="rl-nav__menu hidden lg:flex" role="list">
          {MENU.map((item) => (
            <li key={item.label}>
              <a href={item.href} className="rl-nav__link">
                {item.label}
                <ChevronDown className="rl-nav__chev" aria-hidden />
              </a>
            </li>
          ))}
        </ul>

        {/* Right — actions */}
        <div className="rl-nav__cluster rl-nav__cluster--right">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rl-nav__icon-btn hidden sm:inline-flex"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme === 'dark' ? (
              <Sun className="h-[1.05rem] w-[1.05rem]" aria-hidden />
            ) : (
              <Moon className="h-[1.05rem] w-[1.05rem]" aria-hidden />
            )}
          </button>

          <div className="hidden lg:contents">
            <GithubStars />
            <a href="#demo" className="rl-nav__ghost">
              Contact Sales
            </a>
          </div>

          <Link to="/sign-up" className="rl-nav__cta hidden sm:inline-flex">
            Start Free Trial
          </Link>

          {/* Mobile trigger */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            className="rl-nav__icon-btn lg:hidden"
            aria-expanded={open}
            aria-controls="rl-mobile-nav"
            aria-label="Open menu"
          >
            <MenuGlyph />
          </button>
        </div>
      </nav>

      {/* Mobile sheet — full-screen black panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="rl-mobile-nav"
            className="rl-nav__sheet lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rl-nav__sheet-top">
              <span className="rl-nav__brand">
                <NavMark />
                <span className="rl-nav__wordmark">RoofersLabs</span>
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rl-nav__icon-btn"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <nav className="rl-nav__sheet-list" aria-label="Mobile">
              {MENU.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rl-nav__sheet-link"
                >
                  {item.label}
                  <ChevronDown className="rl-nav__chev -rotate-90" aria-hidden />
                </a>
              ))}
            </nav>

            <div className="rl-nav__sheet-foot">
              <div className="rl-nav__sheet-row">
                <GithubStars />
                <Link
                  to="/sign-in"
                  onClick={() => setOpen(false)}
                  className="rl-nav__ghost"
                >
                  Log in
                </Link>
              </div>
              <a href="#demo" onClick={() => setOpen(false)} className="rl-nav__ghost">
                Contact Sales
              </a>
              <Link to="/sign-up" onClick={() => setOpen(false)} className="rl-nav__cta">
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** A three-line mark that reads as more considered than a stock hamburger. */
function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
