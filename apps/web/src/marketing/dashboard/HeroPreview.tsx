import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transition } from '../motion';
import { AppFrame, Num } from './chrome';
import { featuredCall } from './data';
import { AiConversationPanel } from './panels/CallPanels';
import { AppointmentsPanel } from './panels/SchedulePanels';
import { LiveActivityPanel, MetricsRow } from './panels/InsightPanels';

type Phase = 'ringing' | 'answering' | 'answered';

const PHASE_COPY: Record<Phase, { label: string; detail: string }> = {
  ringing: { label: 'Incoming call', detail: 'Ringing' },
  answering: { label: 'Incoming call', detail: 'Answering' },
  answered: { label: 'Call answered', detail: 'Picked up in 0.4s' },
};

/**
 * The single moment the hero has to land: a call arrives and is answered
 * before it can ring twice. The loop is slow (roughly six seconds) so it reads
 * as a status bar that happens to be alive, not as an attention-grabbing
 * animation. Reduced motion pins it to the resolved state.
 */
function IncomingCall() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? 'answered' : 'ringing');
  const caller = featuredCall;

  useEffect(() => {
    if (reduced) return;
    let timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      setPhase('ringing');
      timers.push(setTimeout(() => setPhase('answering'), 1400));
      timers.push(setTimeout(() => setPhase('answered'), 2300));
    };

    run();
    const loop = setInterval(() => {
      timers.forEach(clearTimeout);
      timers = [];
      run();
    }, 6400);

    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  const live = phase !== 'answered';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-500 ease-smooth',
        live ? 'border-mk-accent-ring/40 bg-mk-accent/[0.10]' : 'border-mk-line bg-mk-card',
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {live && !reduced && (
          <motion.span
            className="absolute inset-0 rounded-full border border-mk-accent-ring"
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-500',
            live
              ? 'border-mk-accent-ring/50 bg-mk-accent/25 text-white'
              : 'border-mk-line bg-white/[0.06] text-white/70',
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
            <path d="M6.5 3.5 8.8 8l-2 1.6a12 12 0 0 0 5.6 5.6L14 13.2l4.5 2.3v3.2a1.5 1.5 0 0 1-1.7 1.5C9.3 19.4 4.6 14.7 3.5 6.7A1.5 1.5 0 0 1 5 5h1.5Z" strokeLinejoin="round" />
          </svg>
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={PHASE_COPY[phase].label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition.fast}
              className="whitespace-nowrap text-[12.5px] font-medium text-white"
            >
              {PHASE_COPY[phase].label}
            </motion.span>
          </AnimatePresence>
          {/* The number is corroborating detail, not the message. On a phone
              it wraps and shoves the status out of line, so it steps aside. */}
          <Num className="hidden whitespace-nowrap text-[11px] text-white/45 sm:inline">
            {caller.phone}
          </Num>
        </div>
        <p className="truncate text-[12px] text-white/70">
          {caller.name} · {caller.city}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={PHASE_COPY[phase].detail}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -4 }}
          transition={transition.fast}
          className={cn(
            'shrink-0 whitespace-nowrap text-[11.5px]',
            live ? 'text-mk-accent-fg' : 'text-white/60',
          )}
        >
          {PHASE_COPY[phase].detail}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/**
 * The hero's product preview. A narrowed slice of the real dashboard — enough
 * to make the promise concrete, not so much that it competes with the
 * headline for the first two seconds of attention.
 */
export function HeroPreview() {
  return (
    <AppFrame nav="Overview" className="h-full">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        <IncomingCall />
        <MetricsRow className="hidden sm:grid" />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AiConversationPanel callId={featuredCall.id} className="min-h-[220px]" />
          <LiveActivityPanel className="hidden min-h-[220px] md:flex" />
          <AppointmentsPanel className="hidden min-h-[220px] xl:flex" />
        </div>
      </div>
    </AppFrame>
  );
}
