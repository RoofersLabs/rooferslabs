import { useEffect, useRef, useState } from 'react';

/**
 * Tracks the user's motion preference and keeps tracking it — people toggle
 * this in system settings while a page is open.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Advances through `count` steps on a fixed cadence once `active` is true, and
 * stops at the last one.
 *
 * Used by the scripted product demos. They play once and hold their final
 * state: a hero that keeps looping reads as a screensaver, and the finished
 * state (a booked appointment, a full transcript) is the actual proof point.
 */
export function useSequence(count: number, active: boolean, intervalMs = 900): number {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !active || step >= count - 1) return;

    const id = window.setTimeout(() => setStep((current) => current + 1), intervalMs);
    return () => window.clearTimeout(id);
  }, [active, count, intervalMs, reduced, step]);

  // With reduced motion the demo is presented already complete — the
  // information still lands, nothing moves to get it there. Derived rather than
  // pushed through state so there is no intermediate render showing step zero.
  return reduced ? count - 1 : step;
}

/**
 * Reports whether the element has entered the viewport at least once.
 *
 * Distinct from the CSS reveal system: this drives React state (starting a
 * counter, kicking off a scripted demo) rather than a class change.
 */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px -15% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0.15 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView] as const;
}

/**
 * Window scroll offset in pixels, sampled at most once per frame.
 *
 * Consumers use it for parallax and for the navigation's scrolled state. The
 * listener is passive so it can never block scrolling, and the rAF gate means a
 * fast trackpad flick still only produces one React render per frame.
 */
export function useScrollOffset(): number {
  const [offset, setOffset] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        setOffset(window.scrollY);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  return offset;
}
