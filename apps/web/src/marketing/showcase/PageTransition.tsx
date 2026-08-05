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
 * About a third of a second out and in, on the product's own standard curve. Fast enough that
 * the navigation feels answered, slow enough that the eye follows the change
 * rather than being handed a different screen.
 */
export function PageTransition({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: reduced ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduced ? 0 : -6 }}
        transition={{
          duration: 0.36,
          ease: [0.4, 0, 0.2, 1],
          exit: { duration: 0.34 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
