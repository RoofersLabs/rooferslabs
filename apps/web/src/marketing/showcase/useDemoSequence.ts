import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL, LOOP, TIMELINE, reduce, type Beat, type DemoState } from './DemoTimeline';

/**
 * A clock other components can read without re-rendering on every frame.
 *
 * The call duration counter needs the current time sixty times a second and
 * needs to *display* it once a second. Putting the clock in React state would
 * re-render the whole application replica for each of those frames; putting it
 * in a store lets one leaf subscribe, compare seconds, and update only when the
 * number it shows actually changes.
 */
export type DemoClock = {
  get: () => number;
  subscribe: (listener: (ms: number) => void) => () => void;
};

function createClock() {
  let now = 0;
  const listeners = new Set<(ms: number) => void>();
  return {
    get: () => now,
    subscribe(listener: (ms: number) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(ms: number) {
      now = ms;
      listeners.forEach((listener) => listener(ms));
    },
  };
}

/**
 * Runs the timeline.
 *
 * One `requestAnimationFrame` loop advances a single clock, applies whichever
 * beats have come due, and wraps at the end. React state changes only when a
 * beat fires — a handful of times per page — so a demo that plays for minutes
 * costs the same as one that plays for seconds.
 *
 * It stops completely when the device is off screen, when the tab is in the
 * background, when the visitor prefers reduced motion, and the moment the
 * visitor touches the application themselves. A demo that keeps playing under a
 * user's cursor is fighting them for control of the thing it is demonstrating.
 */
export function useDemoSequence({ playing }: { playing: boolean }) {
  const [state, setState] = useState<DemoState>(INITIAL);
  const [clock] = useState(createClock);
  const elapsed = useRef(0);
  const cursor = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!playing) return;

    let previous = performance.now();

    const tick = (now: number) => {
      frame.current = requestAnimationFrame(tick);

      // Clamped so a tab restored after a minute in the background resumes
      // rather than fast-forwarding through three loops of beats.
      const delta = Math.min(now - previous, 64);
      previous = now;
      elapsed.current += delta;

      if (elapsed.current >= LOOP) {
        elapsed.current -= LOOP;
        cursor.current = 0;
      }
      clock.set(elapsed.current);

      const due: Beat[] = [];
      for (let beat = TIMELINE[cursor.current]; beat && beat.at <= elapsed.current;) {
        due.push(beat);
        cursor.current += 1;
        beat = TIMELINE[cursor.current];
      }
      if (due.length) {
        setState((current) =>
          due.reduce((next, beat) => reduce(next, beat.action, beat.at), current),
        );
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [clock, playing]);

  /** Hands the application back to the visitor, wherever the demo had got to. */
  const restart = useCallback(() => {
    elapsed.current = 0;
    cursor.current = 0;
    clock.set(0);
    setState(INITIAL);
  }, [clock]);

  return { state, setState, clock: clock as DemoClock, restart };
}

/** The loop clock in milliseconds, for the one component that needs every frame. */
export function useDemoSeconds(clock: DemoClock, since: number | null): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (since === null) return;
    const update = (ms: number) => {
      const next = Math.max(0, Math.floor((ms - since) / 1000));
      setSeconds((current) => (current === next ? current : next));
    };
    update(clock.get());
    return clock.subscribe(update);
  }, [clock, since]);

  return seconds;
}
