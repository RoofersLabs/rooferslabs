import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '../lib/hooks';

/**
 * A procedural wave-field: hundreds of hairline vertical strokes whose tops
 * trace a travelling wave surface.
 *
 * Canvas 2D, not WebGL or SVG. ~550 one-pixel strokes per frame is nothing to
 * a 2D context, the canvas itself composites on the GPU, and the whole effect
 * stays readable in one file — a shader would buy no visible smoothness here
 * and cost every future reader the ability to tweak it.
 *
 * WHY IT CANNOT VISIBLY LOOP
 * Each layer sums two sines whose spatial and temporal frequencies are
 * mutually irrational-ish (1.15/2.6, 1.45/2.1, 1.7/2.9) and drift against a
 * third, much slower amplitude "breath". The combined period is hours long, so
 * there is no seam to notice.
 *
 * LIFECYCLE
 * The rAF loop runs only while the canvas is actually on screen and the tab is
 * visible; an IntersectionObserver and `visibilitychange` both gate it. Under
 * `prefers-reduced-motion` no loop ever starts — a single static frame is
 * drawn instead, so the texture and depth survive but nothing moves.
 *
 * Reusable by design: the component is just a canvas that fills its parent and
 * fades itself out at every edge. Any section can mount one behind a
 * `position: relative` shell.
 */

type WaveLayer = {
  /** Horizontal distance between strokes, CSS px. */
  spacing: number;
  /** Rest height of the surface, as a fraction of canvas height from the top. */
  base: number;
  /** Peak amplitude as a fraction of canvas height. */
  amp: number;
  /** Spatial frequencies (waves across the width) of the two sine terms. */
  f1: number;
  f2: number;
  /** Temporal frequencies, radians per millisecond. Small on purpose. */
  w1: number;
  w2: number;
  phase: number;
  stroke: string;
};

/**
 * Back-to-front. Nearer layers sit lower, swing further, travel faster and
 * draw brighter — four cues that read together as parallax depth without any
 * of them being individually noticeable.
 */
const LAYERS: WaveLayer[] = [
  {
    spacing: 9,
    base: 0.44,
    amp: 0.15,
    f1: 1.15,
    f2: 2.6,
    w1: 0.00019,
    w2: 0.00012,
    phase: 1.7,
    stroke: 'rgba(255,255,255,0.05)',
  },
  {
    spacing: 8,
    base: 0.57,
    amp: 0.19,
    f1: 1.45,
    f2: 2.1,
    w1: 0.00028,
    w2: 0.00017,
    phase: 3.9,
    stroke: 'rgba(255,255,255,0.068)',
  },
  {
    spacing: 7,
    base: 0.7,
    amp: 0.23,
    f1: 1.7,
    f2: 2.9,
    w1: 0.00038,
    w2: 0.00023,
    phase: 0.6,
    stroke: 'rgba(255,255,255,0.088)',
  },
];

/** The front layer's surface carries the accent crest highlight. */
const FRONT = LAYERS[LAYERS.length - 1] as WaveLayer;

/** Fixed timestamp for the reduced-motion still — chosen for a pleasant pose. */
const STATIC_T = 8600;

function surfaceY(layer: WaveLayer, u: number, t: number, height: number): number {
  // The breath: amplitude drifts ±14% on a ~57s cycle, far slower than the
  // travel, so the field feels alive without ever visibly "doing" anything.
  const breathe = 1 + 0.14 * Math.sin(t * 0.00011 + layer.phase * 2.1);
  const a = layer.amp * height * breathe;
  return (
    layer.base * height -
    a *
      (0.64 * Math.sin(u * Math.PI * 2 * layer.f1 - t * layer.w1 + layer.phase) +
        0.36 * Math.sin(u * Math.PI * 2 * layer.f2 + t * layer.w2 + layer.phase * 1.8))
  );
}

export function WaveField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let onScreen = true;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;

      for (const layer of LAYERS) {
        ctx.strokeStyle = layer.stroke;
        ctx.beginPath();
        for (let x = 0; x <= width; x += layer.spacing) {
          // Strokes run from the bottom edge up to the wave surface — the
          // tops of the lines ARE the wave.
          const y = surfaceY(layer, x / width, t, height);
          ctx.moveTo(x + 0.5, height);
          ctx.lineTo(x + 0.5, y);
        }
        ctx.stroke();
      }

      // Accent crest: short segments along the front surface whose opacity
      // rises with height, so only the upper reaches of each swell catch the
      // light. Peak alpha stays well under 0.5 — separation, not neon.
      const step = 26;
      const ampPx = FRONT.amp * height * 1.14;
      let prevY = surfaceY(FRONT, 0, t, height);
      for (let x = step; x <= width + step; x += step) {
        const y = surfaceY(FRONT, x / width, t, height);
        const crest = (FRONT.base * height - Math.min(prevY, y)) / ampPx;
        const lift = Math.max(0, (crest - 0.45) / 0.55);
        const alpha = lift * lift * 0.42;
        if (alpha > 0.012) {
          ctx.strokeStyle = `rgba(37,99,235,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x - step, prevY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        prevY = y;
      }
    };

    const loop = () => {
      draw(performance.now());
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!frame && !reduced && onScreen && !document.hidden) {
        frame = requestAnimationFrame(loop);
      }
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      // Capped at 2: past that the extra device pixels are invisible on
      // hairlines and quadruple the fill cost.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Keep the still current for reduced motion (and paint the first frame
      // before the loop's first tick, so there is never a blank flash).
      draw(reduced ? STATIC_T : performance.now());
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = Boolean(entry?.isIntersecting);
        if (onScreen) start();
        else stop();
      },
      { rootMargin: '96px' },
    );

    const onVisibility = () => (document.hidden ? stop() : start());

    const resizeObserver = new ResizeObserver(resize);
    resize();
    resizeObserver.observe(canvas);
    observer.observe(canvas);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block h-full w-full', className)}
      // Two masks intersected: the field dissolves before it can touch any
      // edge. A wave that ends on a visible rectangle boundary stops being
      // atmosphere and becomes a texture swatch.
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent, #000 24%, #000 76%, transparent), linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
        maskComposite: 'intersect',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 24%, #000 76%, transparent), linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)',
        WebkitMaskComposite: 'source-in',
      }}
    />
  );
}
