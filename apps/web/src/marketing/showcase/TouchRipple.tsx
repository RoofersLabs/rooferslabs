import { AnimatePresence, motion } from 'framer-motion';
import type { PointerSpot } from './useAutoNavigation';

/**
 * The tap, on the phone.
 *
 * A phone has no cursor, so there is nothing to move — the only thing to show
 * is contact. A finger's worth of circle appears where the tap lands, expands
 * once and is gone, which is exactly what the platform's own touch feedback
 * does and exactly as long as it lasts.
 */
export function TouchRipple({ spot, press }: { spot: PointerSpot; press: number }) {
  if (!spot.found || press === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        <motion.span
          key={press}
          className="absolute block rounded-full bg-accent"
          style={{ left: spot.x - 26, top: spot.y - 26, width: 52, height: 52 }}
          initial={{ scale: 0.35, opacity: 0.28 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.62, ease: [0, 0, 0.2, 1] }}
        />
      </AnimatePresence>
    </div>
  );
}
