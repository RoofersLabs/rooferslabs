import { useCallback, useEffect, useRef, useState } from 'react';

export interface CardCarousel {
  /** Index of the card currently occupying most of the viewport. */
  index: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  next: () => void;
  previous: () => void;
  /** Spread onto the scroll track. */
  handlers: {
    onScroll: () => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
}

/**
 * Reads — and nudges — a CSS scroll-snap carousel.
 *
 * The gesture itself is entirely CSS and the browser's own scroller: touch
 * tracking, momentum, rubber-banding at the ends and the snap all happen off
 * the main thread, which is why no drag handling appears here. This hook does
 * only the two things CSS cannot express: report which card is showing, so the
 * "N more to review" line and the arrow buttons stay truthful, and move the
 * scroller when those buttons or the arrow keys are used.
 *
 * Position is measured from live geometry rather than arithmetic on a card
 * width, so it stays correct through a resize, an orientation change, a font
 * that lands late, or a lead list that grows under the finger.
 *
 * The track's ref is passed in rather than handed back: a hook that returns one
 * makes every other value it returns look like a ref to the compiler's lint
 * rules, and `index` here is ordinary render-time state that must not be.
 */
export function useCardCarousel(
  ref: React.RefObject<HTMLDivElement | null>,
  count: number,
): CardCarousel {
  const [rawIndex, setIndex] = useState(0);
  const frame = useRef<number | null>(null);

  // Clamped on read, never stored clamped: the deck can shrink under the finger
  // (a refetch, a lead handled elsewhere) and deriving the value means there is
  // no moment where state and props disagree.
  const index = count === 0 ? 0 : Math.min(rawIndex, count - 1);

  /**
   * Coalesce to one measurement per frame. Scroll fires far faster than paint,
   * and reading rects on every event is the classic way to turn a 60fps native
   * scroll into a janky one.
   */
  const sync = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const track = ref.current;
      if (track) setIndex(mostVisible(track));
    });
  }, [ref]);

  useEffect(() => {
    // A rotation or a keyboard opening changes which card is aligned without
    // ever firing a scroll event.
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [sync]);

  const scrollToIndex = useCallback(
    (to: number) => {
      const track = ref.current;
      const target = track?.children[to];
      if (!track || !target) return;

      // Scroll by the distance to the target's snap position rather than
      // setting an absolute offset: the track's own scroll-padding is the
      // alignment reference, and reading it keeps this correct if the gutter
      // changes at a breakpoint. Mandatory snapping settles any rounding.
      const padding = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      const left =
        target.getBoundingClientRect().left - track.getBoundingClientRect().left - padding;

      track.scrollBy({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [ref],
  );

  const canGoNext = index < count - 1;
  const canGoPrevious = index > 0;

  const next = useCallback(() => {
    if (canGoNext) scrollToIndex(index + 1);
  }, [canGoNext, index, scrollToIndex]);

  const previous = useCallback(() => {
    if (canGoPrevious) scrollToIndex(index - 1);
  }, [canGoPrevious, index, scrollToIndex]);

  /**
   * A focused scroll container already answers the arrow keys, but by a fixed
   * pixel step that lands mid-card and leaves the snap to clean up. Stepping by
   * whole cards makes the keyboard behave exactly like the buttons.
   *
   * Home and End are deliberately not handled. `scroll-snap-stop: always` — the
   * property that stops a hard flick from throwing three cards past the eye —
   * applies to programmatic scrolls too, so no single call can travel further
   * than the next snap point. A key labelled "jump to the last lead" that moved
   * one card would be a worse answer than leaving it to the browser.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }
    },
    [next, previous],
  );

  return {
    index,
    canGoNext,
    canGoPrevious,
    next,
    previous,
    handlers: { onScroll: sync, onKeyDown },
  };
}

/**
 * The card sharing the most width with the scrollport — which is what "the card
 * you are looking at" means, at rest and mid-swipe alike. Ties fall to the
 * earlier card, so the counter flips only once the next one is genuinely ahead.
 */
function mostVisible(track: HTMLElement): number {
  const view = track.getBoundingClientRect();
  let best = 0;
  let widest = -Infinity;

  Array.from(track.children).forEach((item, i) => {
    const box = item.getBoundingClientRect();
    const overlap = Math.min(box.right, view.right) - Math.max(box.left, view.left);
    if (overlap > widest) {
      widest = overlap;
      best = i;
    }
  });

  return best;
}

/** Read at call time, not at mount: the setting can change while the app is open. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
