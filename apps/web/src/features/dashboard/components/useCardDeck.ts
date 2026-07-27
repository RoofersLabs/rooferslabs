import { useCallback, useEffect, useRef, useState } from 'react';

/** Past this many pixels, releasing commits to the next card instead of snapping back. */
const COMMIT_DISTANCE = 72;
/** …or past this speed (px/ms), so a short flick counts as intent too. */
const COMMIT_VELOCITY = 0.45;
/** Matches `duration-base` (200ms) in the theme. */
const SETTLE_MS = 200;

export interface CardDeck {
  index: number;
  /** Live finger offset in px while dragging; 0 at rest. */
  offset: number;
  /** Non-zero while a committed card is animating away: -1 up, 1 down. */
  leaving: 0 | -1 | 1;
  dragging: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  next: () => void;
  previous: () => void;
  /** Spread onto the draggable card. */
  handlers: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerCancel: (event: React.PointerEvent) => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
  };
}

/**
 * Drag-to-advance for a vertical card deck.
 *
 * Written against pointer events rather than a gesture library: `framer-motion`
 * is already a dependency but only inside the lazily-loaded marketing chunk, so
 * importing it here would pull ~35kB gzipped into the authenticated app's main
 * bundle — a real cost on a phone at a job site, for one section's animation.
 * Everything below is transform and opacity, which the compositor handles
 * without layout work.
 *
 * A commit is deliberately two-phase: the card animates out, then the index
 * changes. Swapping first would make the outgoing card jump.
 */
export function useCardDeck(count: number): CardDeck {
  const [rawIndex, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState<0 | -1 | 1>(0);
  const [dragging, setDragging] = useState(false);

  const start = useRef<{ y: number; at: number } | null>(null);
  const last = useRef<{ y: number; at: number } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clamped on read rather than stored clamped: a deck that shrinks under the
  // pointer (a refetch, a lead handled elsewhere) must not leave the index past
  // the end, and deriving it means there is no moment where state and props
  // disagree.
  const index = count === 0 ? 0 : Math.min(rawIndex, count - 1);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const canGoNext = index < count - 1;
  const canGoPrevious = index > 0;

  /** Animate the current card away, then land on `to`. */
  const commit = useCallback((to: number, direction: -1 | 1) => {
    if (settleTimer.current) return; // a transition is already running
    setDragging(false);
    setOffset(0);
    setLeaving(direction);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setLeaving(0);
      setIndex(to);
    }, SETTLE_MS);
  }, []);

  const next = useCallback(() => {
    if (canGoNext) commit(index + 1, -1);
  }, [canGoNext, commit, index]);

  const previous = useCallback(() => {
    if (canGoPrevious) commit(index - 1, 1);
  }, [canGoPrevious, commit, index]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    // Let the call button, and any link, receive the tap untouched.
    if ((event.target as HTMLElement).closest('a,button')) return;
    if (settleTimer.current) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    start.current = { y: event.clientY, at: event.timeStamp };
    last.current = start.current;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      const delta = event.clientY - start.current.y;
      last.current = { y: event.clientY, at: event.timeStamp };
      // Resist pulling past either end, so the deck's limits are felt rather
      // than discovered by nothing happening.
      const blocked = (delta < 0 && !canGoNext) || (delta > 0 && !canGoPrevious);
      setOffset(blocked ? delta * 0.25 : delta);
    },
    [canGoNext, canGoPrevious],
  );

  const finish = useCallback(
    (event: React.PointerEvent) => {
      const origin = start.current;
      start.current = null;
      setDragging(false);
      if (!origin) return;

      const delta = event.clientY - origin.y;
      const elapsed = Math.max(1, event.timeStamp - (last.current?.at ?? origin.at) || 1);
      const velocity = Math.abs(delta) / Math.max(1, event.timeStamp - origin.at || elapsed);
      const decisive = Math.abs(delta) > COMMIT_DISTANCE || velocity > COMMIT_VELOCITY;

      if (decisive && delta < 0 && canGoNext) {
        commit(index + 1, -1);
        return;
      }
      if (decisive && delta > 0 && canGoPrevious) {
        commit(index - 1, 1);
        return;
      }
      setOffset(0); // snap back
    },
    [canGoNext, canGoPrevious, commit, index],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        previous();
      }
    },
    [next, previous],
  );

  return {
    index,
    offset,
    leaving,
    dragging,
    canGoNext,
    canGoPrevious,
    next,
    previous,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onKeyDown,
    },
  };
}
