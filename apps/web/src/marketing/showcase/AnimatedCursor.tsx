import { AnimatePresence, motion } from 'framer-motion';
import type { PointerSpot } from './useAutoNavigation';

const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

/**
 * The pointer, on the iPad.
 *
 * It travels to a control and clicks it, and the two are separate events with
 * a gap between them, because that is the difference between watching someone
 * use software and watching software use itself.
 *
 * The travel is a tween on a fixed curve rather than a spring: a cursor that
 * overshoots its target and settles back is a cursor nobody has ever had.
 */
export function AnimatedCursor({ spot, press }: { spot: PointerSpot; press: number }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-50"
      initial={false}
      animate={{ x: spot.x, y: spot.y, opacity: spot.found ? 1 : 0 }}
      transition={{
        x: { duration: 1.05, ease: EASE_STANDARD },
        y: { duration: 1.05, ease: EASE_STANDARD },
        opacity: { duration: 0.35 },
      }}
    >
      {/* The click, drawn from the contact point outwards. One ring, one
          pass — anything that pulses reads as a beacon rather than a click. */}
      <AnimatePresence>
        <motion.span
          key={press}
          className="absolute -left-4 -top-4 block h-8 w-8 rounded-full border border-accent"
          initial={{ scale: 0.3, opacity: 0.55 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
        />
      </AnimatePresence>

      <motion.svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        fill="none"
        aria-hidden
        className="block drop-shadow-[0_2px_4px_rgba(8,12,24,0.35)]"
        animate={{ scale: 1 }}
        key={`arrow-${press}`}
        initial={{ scale: 0.88 }}
        transition={{ duration: 0.3, ease: EASE_STANDARD }}
      >
        <path
          d="M4 2.2 17.1 14.4h-6.5l-1.2 5.8L4 2.2Z"
          fill="#fff"
          stroke="rgba(12,16,28,0.55)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}
