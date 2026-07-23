import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '../../lib/hooks';
import { VOLUME } from './data';
import { EASE_OUT } from './config';

/** Strong ease-out: most of the distance immediately, then it settles. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * A number that counts to its value once.
 *
 * `tabular-nums` on the container fixes the digit width, so a counter running
 * from 0 to 164 never changes the card's layout while it climbs — the most
 * common way this effect is got wrong.
 */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / 1100, 1);
      setDisplay(Math.round(value * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);

  // Reduced motion renders the destination rather than animating to it.
  const shown = reduced ? value : display;

  return (
    <span aria-label={`${value}${suffix}`}>
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
    </span>
  );
}

/**
 * Twelve-hour call volume, drawn as a line.
 *
 * The path is stroked in with `pathLength`, which is the one honest way to
 * animate a chart: the line is drawn the way it was measured, left to right,
 * rather than fading in as a finished picture.
 */
function Sparkline() {
  const reduced = useReducedMotion();
  const peak = Math.max(...VOLUME);
  const width = 100;
  const height = 28;

  const points = VOLUME.map((value, index) => {
    const x = (index / (VOLUME.length - 1)) * width;
    const y = height - (value / peak) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden="true"
    >
      {/* Fill first so the stroke sits on top of its own shading. */}
      <motion.polygon
        points={`0,${height} ${points.join(' ')} ${width},${height}`}
        fill="rgb(37 99 235 / 0.12)"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5, ease: EASE_OUT }}
      />
      <motion.polyline
        points={points.join(' ')}
        fill="none"
        stroke="#2563EB"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE_OUT }}
      />
    </svg>
  );
}

const TILES = [
  { label: 'Calls answered', value: 393, suffix: '', note: 'Today' },
  { label: 'Booked', value: 164, suffix: '', note: '+18% WoW' },
  { label: 'Answer rate', value: 100, suffix: '%', note: 'First ring' },
  { label: 'Avg. pickup', value: 1, suffix: '.2s', note: 'Median' },
];

/**
 * Four tiles, identical in structure so they read as one instrument panel.
 *
 * The chart deliberately lives elsewhere (`VolumePanel`): putting it inside one
 * tile makes that tile taller than its three neighbours, and four sparklines
 * would be four things competing for the same glance.
 */
export function MetricsRow() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TILES.map((tile, index) => (
        <div
          key={tile.label}
          className={cn(
            'rounded-lg border border-subtle bg-white/[0.015] px-3 py-2.5',
            // Always exactly one row. Wrapping to two rows on a phone would
            // eat the height the live call panel needs to stay readable.
            index > 1 && 'hidden sm:block',
          )}
        >
          <p className="truncate text-[0.625rem] text-ink-tertiary">{tile.label}</p>
          <p className="mt-1.5 text-lg font-medium tabular-nums leading-none tracking-tight">
            <Counter value={tile.value} suffix={tile.suffix} />
          </p>
          <p className="mt-1 truncate text-[0.5625rem] text-ink-quaternary">{tile.note}</p>
        </div>
      ))}
    </div>
  );
}

/** Call volume for the day, as its own panel so the line has room to read. */
export function VolumeChart() {
  return (
    <div className="px-3 py-2.5">
      <Sparkline />
      <div className="mt-1.5 flex justify-between font-mono text-[0.5625rem] text-ink-quaternary">
        <span>7a</span>
        <span>12p</span>
        <span>6p</span>
      </div>
    </div>
  );
}
