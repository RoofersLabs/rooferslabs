import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

/**
 * The strong ease-out from the marketing token file, restated here because
 * Framer takes a curve array rather than a CSS variable. Keep the two in sync:
 * this is `--mkt-ease-enter`.
 */
const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * Scroll-triggered entrance. Animates transform + opacity only — both are
 * GPU-composited, so a page with ~40 of these still holds 60fps and never
 * triggers layout.
 *
 * A reveal is read, not operated, so it is allowed to run longer than the
 * <300ms an interactive element gets. It still errs short: the content is
 * already legible the moment it starts, and a slow fade just delays reading.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      // Reduced motion keeps the fade and drops the travel. Opacity aids
      // comprehension (it marks the element as newly arrived); the Y movement
      // is the part that causes discomfort.
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: reduced ? 0.2 : 0.5, delay: reduced ? 0 : delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Parent that staggers its `<RevealItem>` children as the group scrolls in. */
export function RevealGroup({
  children,
  className,
  // 55ms. Long enough to read as a cascade, short enough that the last card in
  // a six-item grid isn't still arriving after the user has started reading the
  // first — which is what a 70ms+ stagger felt like on the wider rows.
  stagger = 0.055,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : stagger } },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.2 : 0.5, ease: EASE } },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
