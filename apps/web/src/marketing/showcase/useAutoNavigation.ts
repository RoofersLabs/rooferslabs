import { useEffect, useState, type RefObject } from 'react';
import type { DemoState } from './DemoTimeline';

export type PointerSpot = { x: number; y: number; found: boolean };

const EASE_STANDARD = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Turns the timeline's intentions into things that happen in the DOM: where the
 * cursor is, and where the page has scrolled to.
 *
 * The timeline names controls (`nav:calls`, `appt:a3`) and the chrome tags them
 * with `data-demo-target`. Neither knows anything about the other's layout,
 * which is what stops the demo from acquiring a table of hard-coded
 * coordinates that would be wrong the first time a row's padding changed.
 *
 * Positions come back in the screen's own coordinate space, not the page's: the
 * device is scaled to fit the marketing column, so a measured rectangle is
 * divided by the scale the browser actually applied. Reading it off the element
 * rather than off a prop means the cursor stays on target through a resize
 * without being told one happened.
 */
export function useAutoNavigation(
  screenRef: RefObject<HTMLElement>,
  scrollRef: RefObject<HTMLElement>,
  state: DemoState,
): PointerSpot {
  const [spot, setSpot] = useState<PointerSpot>({ x: 0, y: 0, found: false });
  const { target } = state.pointer;

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || !target) {
      setSpot((current) => ({ ...current, found: false }));
      return;
    }

    let frame = 0;
    let attempts = 0;

    // The control may not exist for another frame or two: a page transition
    // holds the outgoing view until it has finished leaving. Rather than time
    // that coupling into the script, look again until it turns up.
    const find = () => {
      const element = screen.querySelector<HTMLElement>(`[data-demo-target="${target}"]`);
      if (!element) {
        if (attempts++ < 40) frame = requestAnimationFrame(find);
        return;
      }
      const scale = screen.getBoundingClientRect().width / screen.offsetWidth || 1;
      const box = element.getBoundingClientRect();
      const origin = screen.getBoundingClientRect();
      setSpot({
        x: (box.left + box.width / 2 - origin.left) / scale,
        y: (box.top + box.height / 2 - origin.top) / scale,
        found: true,
      });
    };

    find();
    return () => cancelAnimationFrame(frame);
  }, [
    screenRef,
    target,
    state.route,
    state.customer,
    state.article,
    state.settingsTab,
    state.drawer,
  ]);

  // Scrolling the page, as a thumb or a wheel would: eased, and interruptible
  // by the next request rather than queued behind it.
  const { top, seq } = state.scroll;
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const from = container.scrollTop;
    const distance = Math.min(top, container.scrollHeight - container.clientHeight) - from;
    if (Math.abs(distance) < 1) return;

    const duration = 1500;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min((now - start) / duration, 1);
      container.scrollTop = from + distance * EASE_STANDARD(t);
      if (t < 1) frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [scrollRef, top, seq]);

  return spot;
}
