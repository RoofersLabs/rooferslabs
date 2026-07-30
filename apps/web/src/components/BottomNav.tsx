import { NavLink } from 'react-router-dom';
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
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-surface lg:hidden',
        // The home indicator on iOS and the gesture pill on Android sit inside
        // the viewport. Padding the bar by the inset — rather than offsetting
        // it — keeps the white field running to the physical bottom edge while
        // the icons sit above the hardware.
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      {/*
        `flex-1` on every cell, and nothing else: the row is divided into equal
        columns, so each target is exactly one quarter of the bar and the icons
        land on those columns' centres at any width. `justify-around` would have
        given the outermost items half the gap of the inner ones and pulled them
        off centre.

        Capped at 28rem and centred because the bar is also on show at 1023px,
        where four icons spread across the full width read as scattered rather
        than as a group. The cells stay equal either way, and at 56px tall each
        one clears the 44px minimum target on its short side by a wide margin.
      */}
      <ul className="mx-auto flex h-14 max-w-md items-stretch">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              aria-label={item.label}
              className="group flex h-full w-full items-center justify-center outline-none"
            >
              {({ isActive }) => (
                <span
                  className={cn(
                    // 36px pill on a 22px icon: the active destination is legible
                    // without a label, and at rest the bar is nothing but icons
                    // on white. Same two tokens as the sidebar's active row, so
                    // the two navigations agree on what "here" looks like.
                    'flex h-9 w-9 items-center justify-center rounded-full',
                    'transition-[background-color,color] duration-fast ease-standard',
                    // Presses answer on the bar itself; the route change is what
                    // follows, and it should not be the first feedback. The
                    // answer is a fill, not a scale — nothing on this bar moves,
                    // so a mis-tap never reads as the layout shifting.
                    //
                    // The link takes focus, the pill shows it: a ring around the
                    // full-height cell would be clipped by the bar, and one
                    // around a 36px pill is not.
                    'group-focus-visible:ring-2 group-focus-visible:ring-focus group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-surface',
                    isActive
                      ? 'bg-accent-subtle text-accent'
                      : 'text-ink-muted group-active:bg-surface-3 group-active:text-ink',
                  )}
                >
                  <item.icon className="h-[22px] w-[22px]" aria-hidden />
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
