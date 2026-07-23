import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '../lib/hooks';

/**
 * A looping, scripted AI receptionist call — the product demonstrated as a
 * live conversation instead of described in copy.
 *
 * Everything is generated in code: no video, no GIF, no mockup image. The
 * script below is typed data, the timings are one configurable table, and the
 * whole sequence is driven by a single chained-timeout state machine.
 *
 * WHY A CHAIN, NOT A SCHEDULE OF ABSOLUTE TIMESTAMPS
 * One pending timeout exists at any moment, and each step schedules the next.
 * That makes pause/resume trivial: leaving the viewport (or hiding the tab)
 * clears the one pending timer, returning re-schedules it, and the sequence
 * carries on from exactly where it stopped instead of fast-forwarding.
 *
 * THE LOOP
 * After the booked state has held for a few seconds, the whole card fades out,
 * the machine resets underneath the fade, and the cycle restarts. The reset
 * happens at opacity zero, so the viewer never sees messages snap away.
 *
 * Reduced motion never starts the machine — the call renders already resolved,
 * every message and system event in place, with a static duration.
 */

export type ReceptionistTimings = {
  /** Incoming-call banner alone on screen. */
  ring: number;
  /** Connect → AI greeting. The AI answers fast; that is the product. */
  greet: number;
  /** Dwell after an AI line before the caller replies. */
  aiRead: number;
  /** Dwell after a caller line before the AI starts "typing". */
  callerRead: number;
  /** Thinking-indicator duration before an AI line lands. */
  aiThink: number;
  /** How long the resolved call holds before the loop fades. */
  hold: number;
  /** Fade-out duration covering the reset. */
  reset: number;
};

export const RECEPTIONIST_TIMINGS: ReceptionistTimings = {
  ring: 1500,
  greet: 1000,
  aiRead: 1500,
  callerRead: 1200,
  aiThink: 1100,
  hold: 5200,
  reset: 550,
};

type Turn = { id: string; from: 'caller' | 'ai'; text: string };

const TURNS: Turn[] = [
  { id: 'v1', from: 'ai', text: 'Summit Roofing, this is the front desk — how can I help?' },
  { id: 'v2', from: 'caller', text: 'Hi — I think yesterday’s storm damaged my roof.' },
  { id: 'v3', from: 'ai', text: 'Sorry to hear that. Are you seeing any water inside the house?' },
  { id: 'v4', from: 'caller', text: 'No, just missing shingles.' },
  { id: 'v5', from: 'ai', text: 'Then this is a standard inspection — I can have someone out tomorrow morning. Does that work?' },
  { id: 'v6', from: 'caller', text: 'That works.' },
  { id: 'v7', from: 'ai', text: 'Perfect. You’re booked tomorrow, 9:00 to 11:00 AM — confirmation text on its way.' },
];

const EVENTS = [
  'Call connected',
  'Intent detected · storm damage',
  'Knowledge base searched',
  'Lead qualified',
  'Calendar checked',
  'Appointment booked',
  'CRM updated · SMS sent',
];

type Machine = {
  status: 'ringing' | 'live' | 'ended';
  turns: number;
  typing: boolean;
  booked: boolean;
  events: number;
  seconds: number;
  resetting: boolean;
};

const INITIAL: Machine = {
  status: 'ringing',
  turns: 0,
  typing: false,
  booked: false,
  events: 0,
  seconds: 0,
  resetting: false,
};

/** What reduced motion sees: the call already handled, start to finish. */
const RESOLVED: Machine = {
  status: 'ended',
  turns: TURNS.length,
  typing: false,
  booked: true,
  events: EVENTS.length,
  seconds: 102,
  resetting: false,
};

type Step = { after: number; patch: Partial<Machine> };

/**
 * The whole call as one ordered list of beats. System events are interleaved
 * with the turns that cause them — the knowledge-base search happens while the
 * AI is thinking, the qualification lands after the "no water inside" answer —
 * so the event feed reads as the system's actual reasoning, not as a parallel
 * slideshow.
 */
function buildScript(t: ReceptionistTimings): Step[] {
  return [
    { after: t.ring, patch: { status: 'live', events: 1 } },
    { after: t.greet, patch: { turns: 1 } },
    { after: t.aiRead, patch: { turns: 2 } },
    { after: 450, patch: { events: 2 } },
    { after: Math.max(t.callerRead - 450, 200), patch: { typing: true } },
    { after: 400, patch: { events: 3 } },
    { after: Math.max(t.aiThink - 400, 200), patch: { typing: false, turns: 3 } },
    { after: t.aiRead, patch: { turns: 4 } },
    { after: 450, patch: { events: 4 } },
    { after: Math.max(t.callerRead - 450, 200), patch: { typing: true } },
    { after: 400, patch: { events: 5 } },
    { after: Math.max(t.aiThink - 400, 200), patch: { typing: false, turns: 5 } },
    { after: t.aiRead, patch: { turns: 6 } },
    { after: t.callerRead, patch: { typing: true } },
    { after: t.aiThink, patch: { typing: false, turns: 7 } },
    { after: 600, patch: { booked: true, events: 6 } },
    { after: 800, patch: { events: 7 } },
    { after: 900, patch: { status: 'ended' } },
    { after: t.hold, patch: { resetting: true } },
    // The reset fires while the card is at opacity 0 — the loop point is
    // never visible.
    { after: t.reset, patch: { ...INITIAL } },
  ];
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function PhoneGlyph() {
  return (
    <svg
      viewBox="0 0 14 14"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3h2l1 2.5-1.2.8a7 7 0 0 0 3 3l.8-1.2L11 9v2a1 1 0 0 1-1.1 1A9 9 0 0 1 2 4.1 1 1 0 0 1 3 3Z" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 14 14"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="1.75" y="2.75" width="10.5" height="9.5" rx="1.5" />
      <path d="M1.75 5.75h10.5M4.5 1.25v2M9.5 1.25v2" />
    </svg>
  );
}

function Waveform({ live }: { live: boolean }) {
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      {[0.5, 0.9, 0.4, 1, 0.6, 0.85, 0.45, 0.95, 0.55, 0.7].map((scale, index) => (
        <span
          key={index}
          className={cn(
            'w-[2px] origin-center rounded-full transition-[background-color,opacity] duration-300 ease-out',
            live ? 'bg-accent opacity-100' : 'bg-ink-quaternary opacity-50',
          )}
          style={{
            height: `${Math.round(scale * 15)}px`,
            animation: live
              ? `waveform ${740 + index * 55}ms ease-in-out ${index * 45}ms infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[10px] bg-white/[0.08] px-3 py-2.5"
      aria-label="AI is typing"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-ink-tertiary"
          style={{ animation: `typing-dot 1.1s ease-in-out ${index * 170}ms infinite` }}
        />
      ))}
    </span>
  );
}

export function LiveReceptionist({
  timings = RECEPTIONIST_TIMINGS,
  className,
}: {
  timings?: ReceptionistTimings;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [machine, setMachine] = useState<Machine>(INITIAL);
  const [onScreen, setOnScreen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;

    const script = buildScript(timings);
    let visible = false;
    let cancelled = false;

    const stop = () => window.clearTimeout(timerRef.current);

    const scheduleNext = () => {
      const step = script[stepRef.current % script.length] as Step;
      timerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setMachine((current) => ({ ...current, ...step.patch }));
        stepRef.current += 1;
        scheduleNext();
      }, step.after);
    };

    // One gate for both signals. Re-entering restarts the CURRENT step's
    // delay rather than fast-forwarding — a call that "caught up" while you
    // were away would give away that it is a recording.
    const evaluate = () => {
      stop();
      if (visible && !document.hidden) scheduleNext();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        setOnScreen(visible);
        evaluate();
      },
      { rootMargin: '64px' },
    );

    const onVisibility = () => evaluate();

    observer.observe(root);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced, timings]);

  // The call timer. Interval callbacks may set state; the guard inside keeps a
  // stale tick from advancing a call that has already ended or reset.
  useEffect(() => {
    if (reduced || !onScreen || machine.status !== 'live') return;
    const id = window.setInterval(
      () =>
        setMachine((current) =>
          current.status === 'live' ? { ...current, seconds: current.seconds + 1 } : current,
        ),
      1000,
    );
    return () => window.clearInterval(id);
  }, [machine.status, onScreen, reduced]);

  const shown = reduced ? RESOLVED : machine;
  const live = shown.status === 'live';
  const ringing = shown.status === 'ringing';

  return (
    <div ref={rootRef} className={cn('space-y-3', className)}>
      {/* The call card. */}
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-white/10 bg-surface-raised shadow-[0_32px_100px_-40px_rgba(0,0,0,1)]',
          'transition-opacity duration-500 ease-out',
          shown.resetting && 'opacity-0',
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-subtle bg-white/[0.05] text-ink-secondary">
            {ringing && (
              <span
                className="absolute inset-0 rounded-full bg-accent/60"
                style={{ animation: 'pulse-ring 1.4s var(--ease-out) infinite' }}
                aria-hidden="true"
              />
            )}
            <PhoneGlyph />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium">
              {ringing ? 'Incoming call' : '(440) 555-0163'}
            </p>
            <p className="truncate text-xs text-ink-tertiary">
              {ringing
                ? '(440) 555-0163 · Medina, OH'
                : live
                  ? 'Storm damage · Medina, OH'
                  : 'Resolved · appointment booked'}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Waveform live={live} />
            <span className="font-mono text-xs tabular-nums text-ink-tertiary">
              {ringing ? '—:—' : formatClock(shown.seconds)}
            </span>
          </div>
        </div>

        {/* Every turn is in the DOM from the start; only opacity, offset and
            blur animate, so the card's height never moves. Bottom-anchored:
            if a narrow viewport makes the column outgrow the panel, the
            OLDEST lines clip off the top — the way a live transcript should. */}
        <div className="flex h-[352px] flex-col justify-end gap-2 overflow-hidden px-4 py-4 sm:h-[368px]">
          {TURNS.map((turn, index) => {
            const revealed = index < shown.turns;
            const thinkingHere = shown.typing && index === shown.turns && turn.from === 'ai';

            return (
              <div
                key={turn.id}
                className={cn('flex', turn.from === 'ai' ? 'justify-start' : 'justify-end')}
              >
                {thinkingHere ? (
                  <TypingDots />
                ) : (
                  <p
                    className={cn(
                      'max-w-[85%] rounded-[10px] px-3 py-2 text-[0.8125rem] leading-snug',
                      'transition-[opacity,transform,filter] duration-500 ease-out',
                      turn.from === 'ai'
                        ? 'bg-white/[0.08] text-ink'
                        : 'border border-white/15 text-ink-secondary',
                      revealed
                        ? 'translate-y-0 opacity-100 blur-[0px]'
                        : 'translate-y-2 opacity-0 blur-[2px]',
                    )}
                  >
                    {turn.text}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Outcome slot — reserved from the start so booking never resizes
            the card. */}
        <div className="border-t border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div
            className={cn(
              'flex items-center gap-3 transition-[opacity,transform] duration-500 ease-out',
              shown.booked ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <CalendarGlyph />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-medium">
                Storm damage inspection · Tomorrow, 9:00 – 11:00 AM
              </p>
              <p className="truncate text-xs text-ink-tertiary">
                Crew A assigned · Confirmation SMS queued
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What the system did about it, as it happened. */}
      <div
        className={cn(
          'rounded-xl border border-white/10 bg-surface-raised transition-opacity duration-500 ease-out',
          shown.resetting && 'opacity-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
          <h3 className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-tertiary">
            System events
          </h3>
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            {live && (
              <span
                className="absolute inset-0 rounded-full bg-accent"
                style={{ animation: 'pulse-ring 2s var(--ease-out) infinite' }}
              />
            )}
            <span
              className={cn(
                'relative h-1.5 w-1.5 rounded-full transition-colors duration-300 ease-out',
                live ? 'bg-accent' : shown.booked ? 'bg-emerald-400' : 'bg-ink-quaternary',
              )}
            />
          </span>
        </div>
        <ol className="px-4 py-2">
          {EVENTS.map((event, index) => {
            const done = index < shown.events;
            const newest = index === shown.events - 1;
            return (
              <li
                key={event}
                className={cn(
                  'flex items-center gap-2.5 py-[5px] transition-[opacity,transform] duration-300 ease-out',
                  done ? 'translate-x-0 opacity-100' : '-translate-x-1.5 opacity-0',
                )}
              >
                <span
                  className={cn(
                    'h-1 w-1 shrink-0 rounded-full transition-colors duration-300 ease-out',
                    newest && live ? 'bg-accent' : 'bg-ink-quaternary',
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-xs text-ink-secondary">{event}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
