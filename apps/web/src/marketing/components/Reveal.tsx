import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VIEWPORT, staggerItem, staggerItemReduced, staggerParent, transition } from '../motion';

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds to hold before the reveal starts. Use to phrase a small group. */
  delay?: number;
  /** Travel distance in px. Zero gives a pure crossfade. */
  y?: number;
  as?: 'div' | 'section' | 'header' | 'li' | 'p';
};

/**
 * A single element fading up as it enters the viewport.
 *
 * Under `prefers-reduced-motion` the translation is dropped and the element
 * crossfades instead — the reveal still happens, it just stops moving.
 */
export function Reveal({ children, className, delay = 0, y = 16, as = 'div' }: RevealProps) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ ...transition.reveal, delay }}
    >
      {children}
    </Component>
  );
}

/**
 * Wraps a list whose children should enter in sequence. Staggering the items
 * *within* one list is the point; the site never applies one uniform entrance
 * to every section.
 */
export function Stagger({
  children,
  className,
  stagger = 0.07,
  delay = 0,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: 'div' | 'ul' | 'ol';
}) {
  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={staggerParent(stagger, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
    >
      {children}
    </Component>
  );
}

/** A child of `Stagger`. Timing comes from the parent, not from this element. */
export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];

  return (
    <Component className={cn(className)} variants={reduced ? staggerItemReduced : staggerItem}>
      {children}
    </Component>
  );
}
