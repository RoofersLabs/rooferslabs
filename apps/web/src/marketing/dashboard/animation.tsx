import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * The preview's motion vocabulary.
 *
 * Two rules, and they are the whole file. Everything animates once, on the way
 * in, and never again — a dashboard that keeps moving while you read it is a
 * toy. And only `opacity` and `transform` are ever animated, so a section
 * arriving costs the compositor a layer and the main thread nothing.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fires slightly before the panel is fully in frame, so it has settled by the
 *  time the reader's eye reaches it. `once` is what stops the page pulsing on
 *  the way back up. */
const VIEWPORT = { once: true, margin: '-64px 0px -64px 0px' } as const;

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const panelVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

/**
 * One dashboard section entering.
 *
 * `index` phrases a group: sections of the same view are handed 0, 1, 2… and
 * arrive about 70ms apart, which reads as the page assembling rather than as
 * six independent animations that happen to overlap.
 */
export function Reveal({
  children,
  className,
  index = 0,
  as = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
  as?: 'div' | 'section' | 'header';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={reduced ? panelVariantsReduced : panelVariants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ delay: index * 0.07 }}
    >
      {children}
    </Component>
  );
}

/**
 * A list whose rows arrive in sequence.
 *
 * The stagger is inside the list rather than applied to the list as a whole —
 * rows landing one after another is what makes a call log read as something
 * that filled up, instead of a block that faded in.
 */
export function StaggerList({
  children,
  className,
  delay = 0,
  as = 'ul',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'ul' | 'ol' | 'div' | 'tbody';
}) {
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.05, delayChildren: delay } },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
    >
      {children}
    </Component>
  );
}

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const rowVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

/** A child of `StaggerList`. Timing comes from the parent, not from here. */
export function StaggerRow({
  children,
  className,
  as = 'li',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'li' | 'div' | 'tr';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component className={className} variants={reduced ? rowVariantsReduced : rowVariants}>
      {children}
    </Component>
  );
}

/**
 * A figure that counts up to its value the first time it is seen, and rolls to
 * a new one whenever the value changes afterwards.
 *
 * The two behaviours are the same animation with different starting points:
 * the page assembling counts from zero, and a figure ticking over during the
 * day travels the one unit it actually moved. Neither is a separate component,
 * because a KPI that animates differently depending on why it changed is a KPI
 * the eye stops trusting.
 *
 * The element reserves its final width from the first frame (`ch` units against
 * the tabular figure font), so the number growing from 0 to 47 never reflows
 * the label beneath it — a count-up that causes layout shift is worse than no
 * count-up at all.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);
  // The value the next run counts *from*, kept out of state so arriving at a
  // new target does not restart the animation that is reading it.
  const from = useRef(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      from.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const distance = value - origin;
    // A one-unit tick should not take as long as a count-up from zero.
    const duration = Math.abs(distance) > 4 ? 900 : 420;

    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // Quartic ease-out: most of the distance is covered early, so the figure
      // lands rather than creeping the last few units.
      const eased = origin + distance * (1 - Math.pow(1 - t, 4));
      setDisplay(Math.round(eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    });

    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value]);

  return (
    <span
      ref={ref}
      className={cn('inline-block text-right', className)}
      style={{ minWidth: `${String(value).length}ch` }}
    >
      {display}
    </span>
  );
}

/**
 * A proportion bar that sweeps out to its share on entry.
 *
 * `scaleX` from a left origin rather than an animated `width`: the same picture,
 * but it never touches layout, and it is the one thing on this page that could
 * have caused a per-frame reflow.
 */
export function ProportionBar({ percent }: { percent: number }) {
  const reduced = useReducedMotion();

  return (
    <div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-surface-3">
      <motion.div
        className="h-full origin-left rounded-full bg-accent"
        style={{ width: `${percent}%` }}
        initial={{ scaleX: reduced ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
      />
    </div>
  );
}
