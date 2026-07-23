import { useEffect, useState } from 'react';
import { useReducedMotion } from '../lib/hooks';

type CounterProps = {
  /** Final value. */
  value: number;
  /** Digits after the decimal point; also fixes the width of the animation. */
  decimals?: number;
  durationMs?: number;
  /** Begins counting only once the section has been scrolled into view. */
  active: boolean;
};

/** Strong ease-out: most of the distance is covered immediately, then it settles. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Counts up to `value` when its section enters the viewport.
 *
 * `tabular-nums` is applied by the caller's type styles so the digits do not
 * reflow as they change — a counter that jitters its own width while running is
 * the single most common way this effect is got wrong.
 */
export function Counter({ value, decimals = 0, durationMs = 1600, active }: CounterProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active || reduced) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setDisplay(value * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, durationMs, reduced, value]);

  // Reduced motion skips the count entirely and renders the destination. Kept
  // as a derived value so there is never a frame showing zero.
  const shown = reduced ? value : display;

  const formatted = shown.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // The accessible name is the destination, not whatever frame we are on.
  return (
    <span aria-label={value.toLocaleString('en-US', { minimumFractionDigits: decimals })}>
      <span aria-hidden="true">{formatted}</span>
    </span>
  );
}
