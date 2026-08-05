import { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppWindow, type ViewId } from './chrome';
import { notifications } from './data';
import { DashboardView } from './views/DashboardView';
import { CallsView } from './views/CallsView';
import { CustomersView } from './views/CustomersView';
import { AppointmentsView } from './views/AppointmentsView';
import { KnowledgeView } from './views/KnowledgeView';
import { NotificationsView } from './views/NotificationsView';

/**
 * The product, running in the marketing page.
 *
 * This is the authenticated application's own dashboard rebuilt section for
 * section — the same sidebar, header, cards, list rows, status colours and
 * spacing, drawn with the same design tokens and, wherever the component was
 * free of the router and the API, the same components. What a visitor sees here
 * is what they see after signing in, filled with a working day instead of the
 * empty states a new account opens on.
 *
 * Nothing is a screenshot. The navigation moves between real views, search
 * filters real fixtures, the appointment status dropdowns change status and
 * marking a notification read empties the badge — a still image of a live
 * product undersells it, and a video of one is a video.
 */
export function ProductShowcase() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [read, setRead] = useState<Record<string, boolean>>({});
  const reduced = useReducedMotion();

  const isUnread = useCallback((id: string) => read[id] ?? isUnreadInitially(id), [read]);

  const toggleRead = useCallback(
    (id: string) => setRead((prev) => ({ ...prev, [id]: !(prev[id] ?? isUnreadInitially(id)) })),
    [],
  );

  const markAllRead = useCallback(
    () => setRead(Object.fromEntries(notifications.map((item) => [item.id, false]))),
    [],
  );

  const unreadCount = notifications.filter((item) => isUnread(item.id)).length;

  return (
    <AppWindow view={view} unreadCount={unreadCount} onNavigate={setView}>
      {/* `mode="wait"` so the outgoing view is gone before the next arrives:
          two dashboards cross-fading through each other is the one thing that
          would make this read as an animation rather than as an application.
          `initial={false}` keeps the first paint still — the sections inside
          run their own entrance. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -6 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          {view === 'dashboard' && <DashboardView onNavigate={setView} />}
          {view === 'calls' && <CallsView />}
          {view === 'customers' && <CustomersView />}
          {view === 'appointments' && <AppointmentsView />}
          {view === 'knowledge' && <KnowledgeView />}
          {view === 'notifications' && (
            <NotificationsView
              isUnread={isUnread}
              onToggle={toggleRead}
              onMarkAllRead={markAllRead}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </AppWindow>
  );
}

/** A notification's shipped read state, before the visitor has touched it. */
function isUnreadInitially(id: string): boolean {
  return notifications.find((item) => item.id === id)?.unread ?? false;
}
