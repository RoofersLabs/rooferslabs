import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BottomNavItem = {
  to: string;
  /** Not rendered — the bar is icons only — but read aloud as the link's name. */
  label: string;
  icon: LucideIcon;
};

/**
 * The installed app's tab bar: the handheld counterpart to the sidebar.
 *
 * A floating object rather than a strip welded to the bottom edge — a pill
 * inset from all three sides, lifted on `shadow-lg` and outlined with the same
 * hairline the sidebar and header use. Nothing about it is bespoke: the
 * surface, the border, the elevation, the easing and the durations are all
 * tokens, so it reads as the design system continuing onto a phone rather than
 * as a second design system arriving.
 *
 * Icons only, by design. Labels at this width either wrap or truncate, and the
 * four destinations are the ones an owner visits every day — the label is
 * carried by `aria-label` for screen readers instead of by pixels.
 *
 * It navigates rather than replaces: every route here is also in the sidebar,
 * which stays one tap away behind the header trigger for everything that does
 * not fit — so nothing became unreachable and nothing moved.
 *
 * Hidden from `lg` up, the same 1024px line `useIsMobile` and the sidebar's own
 * `collapsible="offcanvas"` use, and done in CSS rather than by measuring the
 * viewport in JS so the bar is right on the first paint instead of appearing a
 * frame later.
 */
export function BottomNav({ items, className }: { items: BottomNavItem[]; className?: string }) {
  const { pathname } = useLocation();

  /**
   * Which cell is lit, resolved here rather than left to each `NavLink`'s own
   * `isActive`, because the indicator is one element for the whole bar and has
   * to know where to slide *to*. Same rule the sidebar matches on, so a nested
   * route (`/settings/phone`) keeps its parent tab lit — and `NavLink` applies
   * the identical test for `aria-current`, so the pixels and the accessibility
   * tree can never disagree.
   */
  const activeIndex = items.findIndex(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 lg:hidden',
        // The bar floats, so this wrapper is only a positioner: it spans the
        // width but must not swallow taps aimed at the page showing through the
        // margins beside and below the pill.
        'pointer-events-none',
        // Three margins, one of them hardware-aware. The iOS home indicator and
        // the Android gesture pill live inside the viewport, so the gap below
        // the pill is the device's own reserved strip *plus* 12px of daylight —
        // which collapses to a plain 12px on the phones that reserve nothing.
        'px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
        className,
      )}
    >
      {/*
        `flex-1` on every cell, and nothing else: the row is divided into equal
        columns, so each target is exactly one quarter of the pill and the icons
        land on those columns' centres at any width. `justify-around` would have
        given the outermost items half the gap of the inner ones and pulled them
        off centre — and would have broken the indicator, whose travel is one
        cell width per step precisely because the cells are equal.

        Capped at 24rem and centred so the pill stays a held object on a tablet
        instead of stretching into a rail; on a phone the 16px side margins bind
        first and it sits just inside both edges.

        Translucency is the header's own recipe, to the pixel — 88% surface over
        an 8px blur — because the two are the same material doing the same job at
        opposite ends of the same screen, and because at 88% the blur is a hint
        of what is underneath rather than a glass panel. It applies only where
        the browser can actually blur; everywhere else the `bg-surface` beneath
        it stays fully opaque, so the icons never sit on a washed-out field
        waiting for a filter that is not coming.
      */}
      <ul
        className={cn(
          'pointer-events-auto relative mx-auto flex h-14 max-w-sm items-stretch',
          'rounded-full border border-line-subtle bg-surface shadow-lg',
          'supports-[backdrop-filter:blur(0px)]:bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)]',
          'supports-[backdrop-filter:blur(0px)]:backdrop-blur',
        )}
      >
        {/*
          The active fill is a single element that slides, not four that switch.
          One `translate3d` per navigation — composited, no layout, no paint —
          against four background-colour cross-fades, and it is the movement
          that carries the meaning: the eye follows the fill to the tab it
          landed on instead of catching one square going out as another comes in.

          `%` in a transform resolves against the element's own box, and the box
          is exactly one cell wide, so `index * 100%` is exact at every viewport
          width without measuring anything. Nothing here reads the DOM, so there
          is no post-layout correction frame and no resize listener.

          Parked under the first cell and faded out when the route is one the bar
          does not carry (`/customers`, a call detail): the bar then shows four
          equal icons and claims nothing, and returning to a tab fades the fill
          back in as it glides.
        */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center',
            'transition-[transform,opacity] duration-slow ease-decelerate motion-reduce:transition-none',
            activeIndex < 0 && 'opacity-0',
          )}
          style={{
            width: `${100 / items.length}%`,
            transform: `translate3d(${Math.max(activeIndex, 0) * 100}%, 0, 0)`,
          }}
        >
          <span className="h-10 w-10 rounded-full bg-accent-subtle" />
        </span>

        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            // `relative`: the cells are positioned siblings that come after the
            // indicator in the DOM, which is what keeps the icons above the fill
            // without a stacking context or a z-index on either.
            <li key={item.to} className="relative flex-1">
              <NavLink
                to={item.to}
                aria-label={item.label}
                className="group flex h-full w-full items-center justify-center outline-none"
              >
                <span
                  className={cn(
                    // The focus ring wraps the fill, not the cell: a ring on the
                    // full-height cell would be clipped by the pill's radius,
                    // and one on a 40px circle sits inside it cleanly.
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    'group-focus-visible:ring-2 group-focus-visible:ring-focus group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface',
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-[22px] w-[22px]',
                      // Colour crosses over faster than the fill travels, so the
                      // icon has arrived by the time the fill reaches it. The 1px
                      // lift is the whole of the icon's own animation — enough to
                      // read as settling into place, too small to be a bounce,
                      // and a transform rather than a size change so it composites
                      // and shifts nothing around it.
                      'transition-[color,transform,opacity] duration-base ease-standard',
                      'motion-reduce:transition-none',
                      isActive ? 'text-accent -translate-y-px' : 'text-ink-muted translate-y-0',
                      // Presses answer on the bar itself; the route change is
                      // what follows, and it should not be the first feedback.
                      // Opacity, so the answer is instant on the compositor and
                      // identical whether the tab is lit or not.
                      'group-active:opacity-60',
                    )}
                    aria-hidden
                  />
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
