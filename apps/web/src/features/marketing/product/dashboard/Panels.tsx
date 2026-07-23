import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ENTER, ROW } from './config';
import { Panel } from './Chrome';
import {
  ACTIVITY,
  BOOKED_APPOINTMENT,
  CALLS,
  INCOMING_CALL,
  NEW_ACTIVITY,
  OUTCOME_LABEL,
  SCHEDULE,
  type CallRow,
} from './data';

const OUTCOME_STYLE: Record<CallRow['outcome'], string> = {
  booked: 'border-accent/30 bg-accent/10 text-accent',
  transferred: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  qualified: 'border-subtle bg-white/[0.04] text-ink-tertiary',
};

/**
 * Recent calls.
 *
 * The incoming call is prepended mid-sequence. It enters by height as well as
 * opacity so the rows beneath it are pushed down rather than being covered —
 * a new row that appears on top of the old one reads as a glitch, while one
 * that makes room for itself reads as a list receiving data.
 */
export function CallsPanel({ incoming }: { incoming: boolean }) {
  const rows = incoming ? [INCOMING_CALL, ...CALLS] : CALLS;

  return (
    <Panel
      title="Recent calls"
      action={<span className="text-[0.625rem] text-ink-quaternary">Live</span>}
    >
      <ul className="divide-y divide-white/[0.05]">
        <AnimatePresence initial={false}>
          {rows.map((call) => (
            <motion.li
              key={call.id}
              layout
              initial={
                call.id === INCOMING_CALL.id
                  ? { opacity: 0, height: 0, transform: 'translateY(-4px)' }
                  : false
              }
              animate={{ opacity: 1, height: 'auto', transform: 'translateY(0px)' }}
              transition={ENTER}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-[9px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.6875rem] font-medium">{call.caller}</p>
                  <p className="truncate text-[0.5625rem] text-ink-quaternary">
                    {call.intent} · {call.city}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[0.5625rem] font-medium',
                    OUTCOME_STYLE[call.outcome],
                  )}
                >
                  {OUTCOME_LABEL[call.outcome]}
                </span>
                <span className="w-7 shrink-0 text-right font-mono text-[0.5625rem] text-ink-quaternary">
                  {call.at}
                </span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}

/**
 * Today's schedule.
 *
 * The booked appointment slides in at the top because it is the earliest slot —
 * its position is information, not decoration.
 */
export function SchedulePanel({ booked }: { booked: boolean }) {
  const items = booked ? [BOOKED_APPOINTMENT, ...SCHEDULE] : SCHEDULE;

  return (
    <Panel
      title="Today"
      action={
        <span className="font-mono text-[0.625rem] text-ink-quaternary">
          {items.length} jobs
        </span>
      }
    >
      <ul className="space-y-1.5 p-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const isNew = item.id === BOOKED_APPOINTMENT.id;
            return (
              <motion.li
                key={item.id}
                layout
                initial={isNew ? { opacity: 0, height: 0, transform: 'translateX(8px)' } : false}
                animate={{ opacity: 1, height: 'auto', transform: 'translateX(0px)' }}
                transition={ENTER}
                className="overflow-hidden"
              >
                <div
                  className={cn(
                    'flex items-start gap-2.5 rounded-md border px-2.5 py-2 transition-colors duration-200 ease-out',
                    isNew
                      ? 'border-accent/25 bg-accent/[0.06]'
                      : 'border-subtle bg-white/[0.02]',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[0.625rem] tabular-nums',
                      isNew ? 'text-accent' : 'text-ink-tertiary',
                    )}
                  >
                    {item.time}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.6875rem] font-medium">{item.customer}</p>
                    <p className="truncate text-[0.5625rem] text-ink-quaternary">
                      {item.job} · {item.crew}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}

/** Activity feed. The newest entry is the one the call on screen produced. */
export function ActivityPanel({ logged }: { logged: boolean }) {
  const items = logged ? [NEW_ACTIVITY, ...ACTIVITY] : ACTIVITY;

  return (
    <Panel title="Activity">
      <ul className="p-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={item.id === NEW_ACTIVITY.id ? { opacity: 0, height: 0 } : false}
              animate={{ opacity: 1, height: 'auto' }}
              transition={ENTER}
              className="overflow-hidden"
            >
              <div className="flex items-baseline gap-2 px-1 py-[5px]">
                <span
                  className={cn(
                    'mt-1 h-1 w-1 shrink-0 rounded-full',
                    item.id === NEW_ACTIVITY.id ? 'bg-accent' : 'bg-ink-quaternary',
                  )}
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 truncate text-[0.625rem] text-ink-secondary">
                  {item.text}
                </p>
                <span className="shrink-0 font-mono text-[0.5625rem] text-ink-quaternary">
                  {item.at}
                </span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}

/** Static wrapper so `Panel`'s chrome is reusable for the chart. */
export function VolumePanel({ children }: { children: React.ReactNode }) {
  return (
    <Panel
      title="Call volume"
      action={<span className="text-[0.625rem] text-ink-quaternary">Today</span>}
    >
      {children}
    </Panel>
  );
}

/** Re-exported for the dashboard's stagger wrapper. */
export { ROW };
