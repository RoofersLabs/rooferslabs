import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transition } from '../../motion';
import { Num, Panel, StatusBadge } from '../chrome';
import { STATUS_LABEL, at, calls, qualification, transcripts, type Call } from '../data';

/** Recent calls — the log every other panel in the Calls view keys off. */
export function RecentCallsPanel({
  selectedId,
  onSelect,
  className,
}: {
  selectedId: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  return (
    <Panel title="Recent calls" className={className} bodyClassName="p-1.5 overflow-y-auto">
      <ul className="flex flex-col gap-0.5">
        {calls.map((call) => {
          const active = call.id === selectedId;
          const content = (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[13px] font-medium text-white">{call.name}</span>
                <Num className="shrink-0 text-[11px] text-white/45">{call.time}</Num>
              </div>
              <p className="mt-0.5 truncate text-[12px] text-white/70">{call.intent}</p>
            </>
          );

          return (
            <li key={call.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(call.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-lg px-2.5 py-2 text-left',
                    'transition-colors duration-200 ease-smooth hover:bg-white/[0.04]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring',
                    active && 'bg-white/[0.06]',
                  )}
                >
                  <div className="min-w-0">{content}</div>
                  <StatusBadge status={call.status} label={STATUS_LABEL[call.status]} />
                </button>
              ) : (
                <div className="flex items-start justify-between gap-3 rounded-lg px-2.5 py-2">
                  <div className="min-w-0">{content}</div>
                  <StatusBadge status={call.status} label={STATUS_LABEL[call.status]} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** The three-dot indicator shown while the model composes its next line. */
function Thinking() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="AI is responding">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-white/45"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

/**
 * The live transcript. Lines arrive one at a time with a pause on the AI's
 * turn, which is what communicates that a conversation is being *held*, not
 * retrieved. Under reduced motion the whole transcript renders at once.
 */
export function AiConversationPanel({ callId, className }: { callId: string; className?: string }) {
  const lines = transcripts[callId] ?? [];

  return (
    <Panel
      title="AI conversation"
      className={className}
      bodyClassName="flex flex-col gap-2.5 overflow-y-auto p-4"
    >
      {/* Keyed on the call so switching calls remounts the replay. Resetting
          the playhead from inside an effect would mean writing state during a
          render pass the component could simply skip. */}
      <Transcript key={callId} lines={lines} />
    </Panel>
  );
}

function Transcript({ lines }: { lines: Array<{ role: 'ai' | 'caller'; text: string }> }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    // Under reduced motion nothing is scheduled at all; the full transcript is
    // rendered directly below, so there is no state to advance.
    if (reduced) return;

    let index = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const step = () => {
      if (index >= lines.length) return;
      const line = at(lines, index);
      const advance = () => {
        setThinking(false);
        setShown((n) => n + 1);
        index += 1;
        timers.push(setTimeout(step, 900));
      };

      if (line.role === 'ai') {
        setThinking(true);
        timers.push(setTimeout(advance, 700));
      } else {
        advance();
      }
    };

    timers.push(setTimeout(step, 400));
    return () => timers.forEach(clearTimeout);
  }, [lines, reduced]);

  const visible = reduced ? lines : lines.slice(0, shown);

  return (
    <>
      {/* A transcript is a log: announce additions politely rather than
          interrupting whatever the reader is on. */}
      <div className="flex flex-col gap-2.5" aria-live="polite">
        {visible.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition.base}
            className={cn('flex', line.role === 'ai' ? 'justify-start' : 'justify-end')}
          >
            <p
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] leading-[1.5]',
                line.role === 'ai'
                  ? 'rounded-tl-sm border border-mk-line bg-white/[0.04] text-white/85'
                  : 'rounded-tr-sm bg-mk-accent/90 text-white',
              )}
            >
              <span className="sr-only">{line.role === 'ai' ? 'AI: ' : 'Caller: '}</span>
              {line.text}
            </p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {thinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition.fast}
            className="w-fit rounded-xl rounded-tl-sm border border-mk-line bg-white/[0.04] px-3"
          >
            <Thinking />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Score ring — an SVG arc that draws to the lead's score. */
function ScoreRing({ score }: { score: number }) {
  const reduced = useReducedMotion();
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#4F7DFF"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{
            strokeDashoffset: reduced ? circumference * (1 - score / 100) : circumference,
          }}
          whileInView={{ strokeDashoffset: circumference * (1 - score / 100) }}
          viewport={{ once: true }}
          transition={{ duration: reduced ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Num className="text-[17px] font-semibold leading-none text-white">{score}</Num>
        <span className="mt-1 text-[9px] uppercase tracking-[0.08em] text-white/45">score</span>
      </div>
    </div>
  );
}

/** Lead qualification — what the model established, and how it scored the lead. */
export function LeadQualificationPanel({ call, className }: { call: Call; className?: string }) {
  return (
    <Panel title="Lead qualification" className={className} bodyClassName="p-4 overflow-y-auto">
      <div className="flex items-center gap-4">
        <ScoreRing score={call.score} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white">{call.name}</p>
          <p className="mt-0.5 text-[12px] text-white/70">{call.intent}</p>
          <Num className="mt-1 block text-[11px] text-white/45">
            {call.phone} · {call.city}
          </Num>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
        {qualification.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-t border-mk-line py-2"
          >
            <dt className="text-[12px] text-white/70">{row.label}</dt>
            <dd className="text-[12px] font-medium text-white">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** AI summary — the written hand-off a human reads instead of the recording. */
export function AiSummaryPanel({ call, className }: { call: Call; className?: string }) {
  return (
    <Panel title="AI summary" className={className} bodyClassName="p-4">
      <p className="text-[13px] leading-[1.65] text-white/85">
        {call.name} called from {call.city} at <Num>{call.time}</Num> about{' '}
        {call.intent.toLowerCase()}. Homeowner confirmed, property is in the service area, and the
        job was accepted without a callback.
      </p>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {['Homeowner', call.city, `${call.duration} call`, STATUS_LABEL[call.status]].map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-mk-line bg-white/[0.03] px-2 py-1 text-[11px] text-white/70"
          >
            {tag}
          </span>
        ))}
      </div>
    </Panel>
  );
}
