import type { Transition, Variants } from 'framer-motion';

/**
 * The marketing site's motion vocabulary.
 *
 * One easing curve carries the entire page. `smooth` is an exponential
 * ease-out: it leaves fast and settles slowly, with no overshoot, which is what
 * makes motion read as composed rather than playful. Nothing here bounces,
 * springs, or scales beyond a couple of percent.
 */
export const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

/** Symmetric curve for state changes that have no clear direction (tab swaps). */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
  reveal: 0.7,
} as const;

export const transition = {
  fast: { duration: DURATION.fast, ease: EASE_STANDARD },
  base: { duration: DURATION.base, ease: EASE_SMOOTH },
  slow: { duration: DURATION.slow, ease: EASE_SMOOTH },
  reveal: { duration: DURATION.reveal, ease: EASE_SMOOTH },
} satisfies Record<string, Transition>;

/**
 * Scroll-reveal defaults. `once` keeps the page calm on the way back up, and
 * the negative margin fires the reveal slightly before the element is fully in
 * frame so it is settled by the time the reader's eye arrives.
 */
export const VIEWPORT = { once: true, margin: '-96px 0px -96px 0px' } as const;

/**
 * Parent/child pair for staggered entrances. Children opt in by using
 * `staggerItem` as their own variants; the parent drives the timing.
 */
export const staggerParent = (stagger = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transition.reveal },
};

/** Reduced-motion equivalents: the same choreography, expressed as a crossfade. */
export const staggerItemReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base } },
};
