import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppFrame, type NavItem } from './chrome';
import { at, calls, featuredCall } from './data';
import {
  AiConversationPanel,
  AiSummaryPanel,
  LeadQualificationPanel,
  RecentCallsPanel,
} from './panels/CallPanels';
import { AppointmentsPanel, CalendarPanel, CustomerTimelinePanel } from './panels/SchedulePanels';
import {
  AnalyticsPanel,
  LiveActivityPanel,
  MetricsRow,
  NotificationsPanel,
} from './panels/InsightPanels';

/**
 * The full product, running in the page.
 *
 * Everything here is a real React component driven by real state: choosing a
 * call re-renders the transcript, the summary and the qualification score;
 * choosing a day moves the calendar selection. Nothing is a screenshot, which
 * is the point — a static image of a live product undersells it.
 */
export function ProductShowcase() {
  const [nav, setNav] = useState<NavItem>('Overview');
  const [callId, setCallId] = useState(featuredCall.id);
  const [day, setDay] = useState(17);

  const call = useMemo(() => calls.find((c) => c.id === callId) ?? at(calls, 0), [callId]);
  const reduced = useReducedMotion();

  const views: Record<NavItem, React.ReactNode> = {
    Overview: (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <MetricsRow />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
          <AnalyticsPanel className="min-h-[200px] lg:col-span-2" />
          <NotificationsPanel className="min-h-[200px]" />
          <LiveActivityPanel className="min-h-[200px]" />
          <AiSummaryPanel call={call} className="min-h-[200px] lg:col-span-2" />
        </div>
      </div>
    ),
    Calls: (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
        <RecentCallsPanel
          selectedId={callId}
          onSelect={setCallId}
          className="min-h-[240px] lg:row-span-2"
        />
        <AiConversationPanel callId={callId} className="min-h-[280px] lg:row-span-2" />
        <LeadQualificationPanel call={call} className="min-h-[240px]" />
        <AiSummaryPanel call={call} className="min-h-[160px]" />
      </div>
    ),
    Appointments: (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <CalendarPanel selectedDay={day} onSelectDay={setDay} />
        <AppointmentsPanel className="min-h-[280px]" />
      </div>
    ),
    Customers: (
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
        <CustomerTimelinePanel className="min-h-[300px] lg:row-span-2" />
        <LeadQualificationPanel call={call} className="min-h-[180px]" />
        <AiSummaryPanel call={call} className="min-h-[140px]" />
      </div>
    ),
    Analytics: (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <MetricsRow />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
          <AnalyticsPanel className="min-h-[260px] lg:col-span-2" />
          <LiveActivityPanel className="min-h-[260px]" />
        </div>
      </div>
    ),
  };

  return (
    <AppFrame nav={nav} onNavigate={setNav} interactive className="min-h-[560px]">
      {/* Section tabs, shown where the sidebar is folded away */}
      <div className="flex gap-1 overflow-x-auto border-b border-mk-line px-3 py-2 lg:hidden">
        {(Object.keys(views) as NavItem[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setNav(item)}
            aria-current={item === nav ? 'true' : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[12.5px] transition-colors duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring ${
              item === nav ? 'bg-white/[0.07] text-white' : 'text-white/50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={nav}
          initial={{ opacity: 0, y: reduced ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -4 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="flex min-h-0 flex-col p-3"
        >
          {views[nav]}
        </motion.div>
      </AnimatePresence>
    </AppFrame>
  );
}
