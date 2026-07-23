import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion vocabulary for the hero dashboard.
 *
 * One easing curve and one distance for everything that enters, so eight
 * independent panels read as one machine rather than eight animations that
 * happen to be on the same screen.
 *
 * The curve is the site's `--ease-out` (0.23, 1, 0.32, 1): most of the distance
 * is covered immediately, then it settles. No bounce, no overshoot — this is
 * meant to look like software reporting state, not like marketing.
 */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const ENTER: Transition = { duration: 0.42, ease: EASE_OUT };

/**
 * Rows and cards arriving in a live panel.
 *
 * `transform` is written as a full string rather than framer-motion's `x`/`y`
 * shorthand: the shorthand animates on the main thread via
 * requestAnimationFrame, and the whole point of this dashboard is that it keeps
 * moving smoothly while the rest of the page is still mounting.
 */
export const ROW: Variants = {
  hidden: { opacity: 0, transform: 'translateY(6px)' },
  shown: { opacity: 1, transform: 'translateY(0px)' },
};

/** Panels arriving as the frame resolves, staggered by position. */
export const PANEL: Variants = {
  hidden: { opacity: 0, transform: 'translateY(10px)' },
  shown: (index: number = 0) => ({
    opacity: 1,
    transform: 'translateY(0px)',
    transition: { ...ENTER, delay: 0.06 * index },
  }),
};

/**
 * The dashboard's scripted timeline, in milliseconds from mount.
 *
 * Keeping every beat in one table is what stops the panels from drifting into
 * each other: the appointment must land *after* the call that booked it, and
 * the activity entry after that. Spread across the individual components these
 * relationships would be invisible and would break the first time one duration
 * changed.
 */
export const BEATS = {
  /** Conversation turns start appearing. */
  conversationStart: 500,
  /** Gap between conversation turns. */
  conversationStep: 900,
  /** A new call arrives at the top of the feed. */
  incomingCall: 3400,
  /** The lead's status resolves from qualifying to qualified. */
  leadQualified: 4600,
  /** The booked appointment slides into the schedule. */
  appointmentBooked: 5300,
  /** Activity feed records it, and the top bar raises a notification. */
  activityLogged: 5900,
} as const;
