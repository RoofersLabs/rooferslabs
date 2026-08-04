import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VIEWPORT, transition } from '../../motion';
import { LiveDot, Num, Panel } from '../chrome';
import { activity, at, metrics, notifications, weekLabels, weekVolume } from '../data';

/**
 * A rolling feed: `size` rows, a new one arriving every `intervalMs`.
 *
 * The counter increments without wrapping so each row can be keyed by its
 * arrival number. That is the whole trick — a key derived from the cycle index
 * changes on *every* row each tick, which makes all of them exit and re-enter
 * at once and renders the stack as overlapping ghosts. With arrival numbers,
 * exactly one row enters and one leaves.
 *
 * Timers stop while the tab is hidden; a background tab should not animate.
 */
function useFeed<T>(source: readonly T[], intervalMs: number, size: number) {
  const reduced = useReducedMotion();
  const [head, setHead] = useState(size - 1);

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      timer = setInterval(() => setHead((n) => n + 1), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, reduced]);

  return Array.from({ length: size }, (_, i) => ({
    key: head - i,
    item: at(source, (head - i) % source.length),
  }));
}

/** The four headline numbers. Values are tabular so they align in a row. */
export function MetricsRow({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {metrics.map((metric, i) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ ...transition.reveal, delay: i * 0.06 }}
          className="rounded-xl border border-mk-line bg-mk-card px-4 py-3 transition-colors duration-200 ease-smooth hover:border-mk-line-strong hover:bg-mk-card-hover"
        >
          <p className="text-[11px] uppercase tracking-[0.07em] text-white/45">{metric.label}</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Num className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-white">
              {metric.value}
            </Num>
            {metric.delta && <Num className="text-[11.5px] text-mk-accent-fg">{metric.delta}</Num>}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Weekly call volume. The bars grow from the baseline on entry; the same data
 * is exposed as a table to assistive technology, since a bar chart conveys
 * nothing without the numbers behind it.
 */
export function AnalyticsPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const peak = Math.max(...weekVolume);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Panel
      title="Calls answered"
      action={<span className="text-[11px] text-white/45">Last 7 days</span>}
      className={className}
      bodyClassName="flex flex-col p-4"
    >
      {/* The chart carries its data in an aria-label rather than a
          visually-hidden table. `sr-only` does not contain a table's layout
          box — it lays out to its content width and drags the document into
          horizontal overflow on narrow viewports. An aria-label has no box at
          all, and seven values read perfectly well as a sentence. */}
      <div
        role="img"
        aria-label={`Calls answered per day over the last seven days: ${weekVolume
          .map((value, i) => `${days[i]} ${value}`)
          .join(', ')}.`}
        // `items-stretch`, not `items-end`: the columns must inherit the full
        // track height or the bars' percentage heights resolve against a
        // zero-height parent and nothing draws.
        className="flex min-h-[92px] flex-1 items-stretch gap-2"
      >
        {weekVolume.map((value, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <motion.div
                className={cn('w-full', value === peak ? 'bg-mk-accent-ring' : 'bg-white/15')}
                initial={{ height: reduced ? `${(value / peak) * 100}%` : '0%' }}
                whileInView={{ height: `${(value / peak) * 100}%` }}
                viewport={VIEWPORT}
                transition={{
                  duration: reduced ? 0 : 0.8,
                  ease: [0.16, 1, 0.3, 1],
                  delay: reduced ? 0 : i * 0.05,
                }}
              />
            </div>
            <span className="text-[10px] text-white/40">{weekLabels[i]}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Notifications. A new item arrives on an interval and pushes the stack down,
 * which is the behaviour the section is describing — the owner finds out
 * without doing anything.
 */
export function NotificationsPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const visible = useFeed(notifications, 4200, 4);

  return (
    <Panel
      title="Notifications"
      action={<LiveDot />}
      className={className}
      bodyClassName="overflow-hidden p-1.5"
    >
      <ul className="flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map(({ key, item }) => (
            <motion.li
              key={key}
              layout={!reduced}
              initial={{ opacity: 0, y: reduced ? 0 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transition.slow}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2"
            >
              <span
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  item.urgent ? 'bg-white' : 'bg-white/25',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[12.5px] font-medium text-white">{item.title}</p>
                  <Num className="shrink-0 text-[11px] text-white/45">{item.time}</Num>
                </div>
                <p className="truncate text-[12px] text-white/70">{item.detail}</p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}

/** Live activity — a compact single-line feed of what the line is doing now. */
export function LiveActivityPanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const visible = useFeed(activity, 2600, 5);

  return (
    <Panel
      title={
        <>
          <LiveDot />
          Live activity
        </>
      }
      className={className}
      bodyClassName="overflow-hidden p-2"
    >
      <ul className="flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map(({ key, item }, i) => (
            <motion.li
              key={key}
              layout={!reduced}
              initial={{ opacity: 0, y: reduced ? 0 : -8 }}
              // Older entries recede, but only to 0.6 — past that the text drops
              // under the AA contrast threshold and becomes decoration.
              animate={{ opacity: 1 - i * 0.1 }}
              exit={{ opacity: 0 }}
              transition={transition.slow}
              className="flex items-center justify-between gap-3 px-2 py-[7px]"
            >
              <span className="truncate text-[12px] text-white">{item.text}</span>
              <Num className="shrink-0 text-[11px] text-white/45">{item.meta}</Num>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}
