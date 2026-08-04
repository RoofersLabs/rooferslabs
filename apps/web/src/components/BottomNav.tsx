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
 * Built into the bottom edge rather than hovering over it. The bar runs the
 * full width and sits flush on the viewport floor, so its own bottom corners
 * are square and the device's are the only ones the eye sees; the two top
 * corners take `radius-2xl`, which is what makes it read as rising out of the
 * hardware instead of resting on the page. A hairline top border is the whole
 * of the separation — no shadow, because a shadow is how a thing announces it
 * is floating, and this one is not.
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
        // Square top corners, like the platform's own tab bars. The 20px it
        // once carried let the page show through two visible notches at the
        // screen edge, which is the one thing that reads as "web page in a
        // frame" rather than as part of the chassis.
        'border-t border-line-subtle bg-surface',
        // The iOS home indicator and the Android gesture pill live inside the
        // viewport. Padding the bar by the inset — rather than lifting it off
        // the floor — is what keeps the white running to the physical edge, so
        // there is no strip of page visible underneath and nothing to suggest
        // the bar is a separate object. On hardware that reserves nothing the
        // padding is zero and the row alone sets the height.
        'pb-[env(safe-area-inset-bottom)]',
        // Landscape on a notched phone puts the cutout beside the bar, not
        // above it, so the row needs the horizontal insets too or the outer
        // tabs sit under the hardware.
        'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
        className,
      )}
    >
      {/*
        `flex-1` on every cell, and nothing else: the row is divided into equal
        columns, so each target is exactly one quarter of the row and the icons
        land on those columns' centres at any width. `justify-around` would have
        given the outermost items half the gap of the inner ones and pulled them
        off centre — and would have broken the indicator, whose travel is one
        cell width per step precisely because the cells are equal.

        The bar is full-width; the row inside it is capped at 28rem and centred.
        On a phone the cap never binds and the two are the same element. It is
        there for the top of the range — a 1023px tablet, where four icons
        strung across the whole width read as scattered rather than as a set,
        while the white field still spans the device.

        64px tall before the safe-area inset: a comfortable target on its short
        side, and the extra weight over a 56px row is what makes the bar feel
        like part of the chassis rather than a strip laid on top of it.
      */}
      <ul className="relative mx-auto flex h-16 max-w-md items-stretch">
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
          {/* 64×36: a capsule laid along the row, not a button pressed into it.
              The width is the icon plus 21px of air on either side, which is
              what lets the fill read as a lane the icon is sitting in rather
              than as a circle drawn around it. */}
          <span className="h-9 w-16 rounded-full bg-accent-subtle" />
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
                    // The focus ring traces the capsule, matching the fill it
                    // would sit on: a ring on the full-height cell would collide
                    // with its neighbours and with the bar's top corners.
                    'flex h-9 w-16 items-center justify-center rounded-full',
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
