import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Container } from './Container';
import { sectionHref } from '../routes';

/**
 * Everything the offer is made of. These are the only values that change when
 * the programme changes — the bar builds every string it renders from them, so
 * nothing below needs editing to move the price, the cohort size or the label.
 */
export const FOUNDING_PROGRAM = {
  name: 'Founding Customer Program',
  /** Used below `sm`, where the full name would crowd out the offer itself. */
  shortName: 'Founding Program',
  cta: 'See what’s included',
  /** Below `sm` the offer earns the width; the link keeps `cta` as its
      accessible name, so nothing is lost to a screen reader. */
  ctaShort: 'Details',
  /** In-page target. A fragment keeps the reader on the page and inherits the
      site's smooth scrolling, which already stands down for reduced motion. */
  href: '#pricing',
} as const;

/**
 * The offer at two lengths. Pricing has not opened, so the bar announces the
 * programme rather than a figure — a price here that nothing can be paid at
 * would be the one claim on the page a visitor could act on and fail. Only one
 * is ever in the accessibility tree: the other is `display: none`, not visually
 * hidden.
 */
const OFFER = {
  full: 'Early access is opening soon.',
  short: 'Opening soon',
} as const;

/**
 * Scroll distance at which the bar tucks away — the same threshold the
 * navigation uses to draw its own chrome, so the whole header settles as one
 * object the moment the page leaves the top.
 */
const COLLAPSE_AT = 12;

/**
 * The promotional bar above the navigation.
 *
 * It is visible at rest and collapses once the reader scrolls, which is what an
 * in-flow banner would do — but the navigation below it is fixed, so the height
 * is animated rather than scrolled. Collapsing (rather than hiding) keeps the
 * link in the tab order; focus re-opens the bar so a keyboard reader never aims
 * at something they cannot see.
 */
export function AnnouncementBar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  // The bar rides the fixed header onto the legal pages, where `#pricing` has
  // nothing to scroll to. See sectionHref.
  const { pathname } = useLocation();

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > COLLAPSE_AT));

  const collapsed = scrolled && !focusWithin;

  return (
    <aside
      aria-label={FOUNDING_PROGRAM.name}
      onFocus={() => setFocusWithin(true)}
      onBlur={() => setFocusWithin(false)}
      className={cn(
        // The hairline is an inset shadow rather than a border: a border would
        // hold the bar 1px tall when collapsed.
        'overflow-hidden bg-gradient-to-r from-mk-accent-700 via-mk-accent-700 to-mk-accent',
        'shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]',
        'transition-[height] duration-300 ease-smooth motion-reduce:transition-none',
        collapsed ? 'h-0' : 'h-10 sm:h-[42px]',
      )}
    >
      <Container>
        {/* The row keeps its full height while the bar closes around it, so the
            content slides out of frame instead of being squashed. */}
        <div
          className={cn(
            'flex h-10 items-center justify-between gap-3 text-[11px] font-medium tracking-[-0.005em] sm:h-[42px] sm:gap-6 sm:text-[12.5px]',
            'transition-opacity duration-200 ease-smooth motion-reduce:transition-none',
            collapsed && 'opacity-0',
          )}
        >
          <p className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {/* On the narrowest phones the programme name is the first thing to
                go: the announcement is the reason to look, and truncating it
                reads as broken. */}
            <span className="whitespace-nowrap text-white max-[359px]:hidden">
              <span className="sm:hidden">{FOUNDING_PROGRAM.shortName}</span>
              <span className="hidden sm:inline">{FOUNDING_PROGRAM.name}</span>
            </span>

            {/* A drawn dot rather than a bullet glyph, which sits off-centre in
                most faces at this size. */}
            <span
              aria-hidden="true"
              className="h-[3px] w-[3px] shrink-0 rounded-full bg-white/45 max-[359px]:hidden"
            />

            <span className="truncate text-white/85">
              <span className="sm:hidden">{OFFER.short}</span>
              <span className="hidden sm:inline">{OFFER.full}</span>
            </span>
          </p>

          <a
            href={sectionHref(FOUNDING_PROGRAM.href, pathname)}
            aria-label={FOUNDING_PROGRAM.cta}
            className={cn(
              'group inline-flex shrink-0 items-center gap-1.5 rounded-sm py-1 text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            )}
          >
            <span className="relative whitespace-nowrap">
              <span className="sm:hidden">{FOUNDING_PROGRAM.ctaShort}</span>
              <span className="hidden sm:inline">{FOUNDING_PROGRAM.cta}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -bottom-px left-0 h-px w-full origin-left scale-x-0 bg-current',
                  'transition-transform duration-300 ease-smooth',
                  'group-hover:scale-x-100 group-focus-visible:scale-x-100',
                  'motion-reduce:transition-none',
                )}
              />
            </span>
            <span
              aria-hidden="true"
              className="transition-transform duration-300 ease-smooth group-hover:translate-x-0.5 motion-reduce:transform-none"
            >
              &rarr;
            </span>
          </a>
        </div>
      </Container>
    </aside>
  );
}
