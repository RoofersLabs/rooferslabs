import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * One page leaving and the next arriving.
 *
 * `mode="wait"` so the outgoing page is gone before the next one starts: two
 * dashboards cross-fading through each other is the single thing that would
 * make this read as an animation rather than as an application. It also means
 * only one page is ever mounted — the sections inside each page run their own
 * entrance, and they only get to run it because the page they belong to was
 * unmounted when it left.
 *
 * `mode="wait"` also means the two halves are serial, so the number that matters
 * is their sum: 140ms out, 220ms in, and the whole swap is over inside 360ms.
 * That is the budget a navigation has before it starts reading as waiting —
 * this used to take twice as long, and the tour felt like it was being paced
 * for the animation rather than for the product.
 *
 * The distances came down with the durations. Travelling the old 8px in 220ms
 * is a snap rather than a move; a few pixels on the same ease-out curve the
 * pages themselves arrive on reads as one motion at either speed.
 */

/** The preview's own ease-out — see `dashboard/animation.tsx`. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function PageTransition({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: reduced ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduced ? 0 : -4 }}
        transition={{
          duration: 0.22,
          ease: EASE_OUT,
          // Leaving is the half nobody is reading: it carries no information,
          // so it takes the smaller share of the budget.
          exit: { duration: 0.14, ease: [0.4, 0, 1, 1] },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
