import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../lib/hooks';
import { Sidebar, TopBar } from './dashboard/Chrome';
import { LiveCallPanel } from './dashboard/LiveCall';
import { MetricsRow, VolumeChart } from './dashboard/Metrics';
import { ActivityPanel, CallsPanel, SchedulePanel, VolumePanel } from './dashboard/Panels';
import { BEATS, ENTER, PANEL } from './dashboard/config';
import { CONVERSATION } from './dashboard/data';

/**
 * The hero's product showcase: the RoofersLabs console, running.
 *
 * Not a screenshot and not a video — real components rendering real data, which
 * is the only version of this that cannot quietly go stale as the product
 * changes.
 *
 * ORCHESTRATION
 * Every moving part is driven from one clock here rather than from timers
 * scattered through the panels. That is what keeps the story coherent: the
 * appointment cannot appear before the call that booked it, and the activity
 * entry cannot precede the appointment. Spread across eight components those
 * relationships would be invisible and would break the first time a duration
 * changed.
 *
 * It plays once and holds. A dashboard looping forever is a screensaver; the
 * settled end state — call resolved, lead qualified, job on the calendar — is
 * the actual argument.
 */
export function HeroDashboard() {
  const reduced = useReducedMotion();

  const [turn, setTurn] = useState(0);
  const [stage, setStage] = useState({
    incoming: false,
    qualified: false,
    booked: false,
    logged: false,
  });

  useEffect(() => {
    if (reduced) return;

    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));

    CONVERSATION.forEach((_, index) => {
      at(BEATS.conversationStart + index * BEATS.conversationStep, () => setTurn(index + 1));
    });

    at(BEATS.incomingCall, () => setStage((s) => ({ ...s, incoming: true })));
    at(BEATS.leadQualified, () => setStage((s) => ({ ...s, qualified: true })));
    at(BEATS.appointmentBooked, () => setStage((s) => ({ ...s, booked: true })));
    at(BEATS.activityLogged, () => setStage((s) => ({ ...s, logged: true })));

    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  // Reduced motion presents the console already resolved. Derived rather than
  // pushed through state, so there is never an intermediate render showing the
  // empty starting position.
  const shownTurn = reduced ? CONVERSATION.length : turn;
  const shown = reduced ? { incoming: true, qualified: true, booked: true, logged: true } : stage;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar notified={shown.logged} />

      <div className="flex min-h-0 flex-1">
        <Sidebar />

        {/* The console body. Panels are staggered by position so the layout
            resolves in reading order rather than arriving all at once. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
          <motion.div variants={PANEL} initial="hidden" animate="shown" custom={0}>
            <MetricsRow />
          </motion.div>

          {/* Below `lg` only the live call survives. Stacking five panels into
              a fixed-height console squashes each to a clipped 40px strip —
              a dashboard that needs two columns should show fewer panels on a
              phone, not smaller ones.

              Rows are explicitly `minmax(0, 1fr)`, not the implicit `auto`.
              With `auto` each row sizes to its content, the two rows together
              exceed the console's fixed height, and the panels spill over the
              ones beneath them instead of clipping — which reads as a broken
              layout, not a dense one. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <motion.div
              variants={PANEL}
              initial="hidden"
              animate="shown"
              custom={1}
              className="min-h-0 lg:col-span-7"
            >
              <LiveCallPanel step={shownTurn} qualified={shown.qualified} />
            </motion.div>

            <motion.div
              variants={PANEL}
              initial="hidden"
              animate="shown"
              custom={2}
              className="hidden min-h-0 lg:col-span-5 lg:block"
            >
              <SchedulePanel booked={shown.booked} />
            </motion.div>

            <motion.div
              variants={PANEL}
              initial="hidden"
              animate="shown"
              custom={3}
              className="hidden min-h-0 lg:col-span-7 lg:block"
            >
              <CallsPanel incoming={shown.incoming} />
            </motion.div>

            <motion.div
              variants={PANEL}
              initial="hidden"
              animate="shown"
              custom={4}
              className="hidden min-h-0 grid-rows-[auto_1fr] gap-2 lg:col-span-5 lg:grid"
            >
              <VolumePanel>
                <VolumeChart />
              </VolumePanel>
              <ActivityPanel logged={shown.logged} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The framed console, including its entrance.
 *
 * The frame reveals with a clip inset from the bottom plus a fractional scale —
 * a mask reveal rather than a slide, so the panel feels like it is being
 * uncovered in place rather than flown in from off screen.
 *
 * The clip is applied here, on a wrapper, and never on an element that an
 * IntersectionObserver is watching: an element clipped to zero area reports
 * itself as not intersecting and would wait forever to be told it had arrived.
 */
export function HeroDashboardFrame() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, clipPath: 'inset(12% 0% 0% 0% round 12px)', transform: 'scale(0.985)' }
      }
      animate={
        reduced
          ? { opacity: 1 }
          : { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 12px)', transform: 'scale(1)' }
      }
      transition={{ ...ENTER, duration: reduced ? 0.3 : 0.9 }}
      className="h-full overflow-hidden rounded-xl border border-subtle bg-surface-raised shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]"
    >
      <HeroDashboard />
    </motion.div>
  );
}

export default HeroDashboardFrame;
