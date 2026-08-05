import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * The device's ambient movement.
 *
 * Two pixels, over nine seconds. It is deliberately below the threshold where
 * you would call it an animation — you notice that the page is not a screenshot
 * without ever noticing the thing that told you. Anything more and the hardware
 * starts bobbing, which is the single most common way a device mock-up gives
 * itself away.
 *
 * One transform on one element, so the compositor carries it and the
 * application inside never repaints.
 */
export function DeviceFloat({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 9, ease: 'easeInOut', repeat: Infinity }}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
}
