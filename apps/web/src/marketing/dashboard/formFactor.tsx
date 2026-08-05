import { createContext, useContext, type ReactNode } from 'react';

/**
 * The width of the screen the replica is running on.
 *
 * The application replica used to switch layouts on Tailwind's `sm:`/`lg:`
 * prefixes, which resolve against the *visitor's viewport*. That was fine while
 * the preview was a fluid panel on the page and its width tracked the window.
 * It is wrong once the preview is a device: an iPhone mock-up on a 1440px
 * desktop would be told `lg` is true and would draw the 256px sidebar into
 * 393px of screen.
 *
 * So the replica asks the device instead. The provider carries the display's
 * own width in CSS pixels — 393 on the iPhone, 834 or 1024 on the iPad — and
 * the hooks below evaluate the application's own breakpoints against it. Every
 * layout switch in the replica is the switch the application makes at that
 * width; only the question changed, from "how wide is the browser?" to "how
 * wide is the screen this is running on?".
 *
 * A plain `sm:` is still safe and is left alone — including inside the shared
 * components the replica borrows, where it could not be changed anyway. The
 * page only shows the iPhone below 640px of browser and only shows an iPad
 * above it, so the visitor's `sm` and the device's `sm` cannot disagree. It is
 * `md:` and `lg:` that had to move: an 834pt iPad sitting in a 1440px window is
 * told `lg` by the browser and denied it by the hardware.
 */

/** Tailwind's own stops, so a replica reads like the page it mirrors. */
const SM = 640;
const LG = 1024;

const ScreenWidthContext = createContext(LG);

export function ScreenProvider({ width, children }: { width: number; children: ReactNode }) {
  return <ScreenWidthContext.Provider value={width}>{children}</ScreenWidthContext.Provider>;
}

export function useScreenWidth(): number {
  return useContext(ScreenWidthContext);
}

/**
 * Below the application's `sm:` — a handset. Reads as the condition it guards:
 * `phone && 'px-4'`.
 */
export function usePhone(): boolean {
  return useScreenWidth() < SM;
}

/**
 * At or above the application's `lg:` — the width where it moves from stacked
 * cards to the two- and four-across desk layouts. An iPad in portrait is *not*
 * wide: 834pt with the sidebar taken out leaves the same room a large phone
 * has, which is exactly why the application waits for 1024 to spread out.
 */
export function useWide(): boolean {
  return useScreenWidth() >= LG;
}
