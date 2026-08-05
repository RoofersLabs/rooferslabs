import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Container } from './Container';
import { sectionHref } from '../routes';

/**
 * Everything the offer is made of. These are the only values that change when
 * the programme changes — the bar builds every string it renders from them, so
 * nothing below needs editing to move the trial, the cohort size or the label.
 */
export const FOUNDING_PROGRAM = {
  name: 'Founding Customers Program',
  trialDays: 14,
  cohort: 20,
  cta: 'Claim Your Spot',
  /** Below `sm` the offer earns the width; the link keeps `cta` as its
      accessible name, so nothing is lost to a screen reader. */
  ctaShort: 'Claim',
  /** In-page target. A fragment keeps the reader on the page and inherits the
      site's smooth scrolling, which already stands down for reduced motion. */
  href: '#pricing',
} as const;

/**
 * The reason to look. It is the loudest thing in the bar — the programme name
 * above it is a label, this is the offer — and it is never abbreviated: below
 * `lg` it takes its own line rather than losing words to the CTA.
 */
const OFFER = `${FOUNDING_PROGRAM.trialDays}-Day Free Trial for the First ${FOUNDING_PROGRAM.cohort} Companies`;

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
 * in-flow banner would do — but the navigation below it is fixed, so the bar is
 * closed rather than scrolled. Collapsing (rather than hiding) keeps the link in
 * the tab order; focus re-opens the bar so a keyboard reader never aims at
 * something they cannot see.
 *
 * The close animates `grid-template-rows` rather than a height, because the bar
 * has no single height to name: the offer sets its own line count from the
 * width and the reader's font size, and a hard height would clip it the moment
 * either one moved.
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
        // hold the bar 1px tall when closed.
        'grid overflow-hidden bg-gradient-to-r from-mk-accent-700 via-mk-accent-700 to-mk-accent',
        'shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)]',
        'transition-[grid-template-rows] duration-300 ease-smooth motion-reduce:transition-none',
        collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
      )}
    >
      {/* `min-h-0` is what lets the 0fr row actually collapse; the fade runs
          ahead of it so the copy is gone before the edge reaches it. */}
      <div
        className={cn(
          'min-h-0 transition-opacity duration-200 ease-smooth motion-reduce:transition-none',
          collapsed && 'opacity-0',
        )}
      >
        <Container>
          {/* Padding rather than a set height, so the row is as tall as the
              message needs and no taller: ~41px on the single-line layout,
              which is the height the bar has always had. */}
          <div className="flex items-center justify-between gap-4 py-2 sm:gap-8 sm:py-2.5 lg:gap-12 lg:py-2">
            {/* Label above offer until the row is wide enough to hold both:
                stacking is deliberate, so the offer never has to compete with
                the programme name for the same line. */}
            <p className="flex min-w-0 flex-col gap-y-0.5 lg:flex-row lg:items-center lg:gap-x-2.5">
              <span className="text-[10.5px] font-medium uppercase leading-[1.35] tracking-[0.08em] text-white/75 sm:text-[11px]">
                {FOUNDING_PROGRAM.name}
              </span>

              {/* The separator between the two halves of the message, drawn
                  rather than typed: a bullet glyph sits off-centre in most
                  faces at this size. It only appears on the single-line
                  layout, where there are in fact two halves to separate. */}
              <span
                aria-hidden="true"
                className="hidden h-[3px] w-[3px] shrink-0 rounded-full bg-white/45 lg:block"
              />

              {/* Balanced, so the narrowest phones — the only widths where the
                  offer wraps at all — get two even lines rather than a full one
                  and a single trailing word. */}
              <span className="text-balance text-[12px] font-semibold leading-[1.35] tracking-[-0.005em] text-white sm:text-[13px]">
                {OFFER}
              </span>
            </p>

            <a
              href={sectionHref(FOUNDING_PROGRAM.href, pathname)}
              aria-label={FOUNDING_PROGRAM.cta}
              className={cn(
                // The leading is named rather than left to the font: the arrow
                // resolves to a fallback face whose default line box is taller
                // than the label's, and it would otherwise set the bar's height.
                'group inline-flex shrink-0 items-center gap-1.5 rounded-sm py-1 text-[11px] font-medium leading-[1.35] text-white sm:text-[12.5px]',
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
      </div>
    </aside>
  );
}
