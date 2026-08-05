import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AppWindow, type ViewId } from '../dashboard/chrome';
import { incomingNotification, notifications } from '../dashboard/data';
import { DashboardView } from '../dashboard/views/DashboardView';
import { AnimatedCursor } from './AnimatedCursor';
import { DeviceFrame, useDeviceKind } from './DeviceFrame';
import { PageTransition } from './PageTransition';
import { TouchRipple } from './TouchRipple';
import { INITIAL, routeAfter } from './DemoTimeline';
import { useAutoNavigation } from './useAutoNavigation';
import { useDemoSeconds, useDemoSequence } from './useDemoSequence';

/**
 * The product, running in the marketing page.
 *
 * Everything inside the device is the authenticated application rebuilt from
 * the product's own components and tokens (see `dashboard/chrome.tsx`). This
 * file is only the operator: it plays the timeline, hands the resulting state
 * to the pages, and draws a cursor on the glass.
 *
 * Three properties are worth keeping true if this is ever changed.
 *
 * **One page is mounted at a time.** `PageTransition` unmounts the outgoing
 * page before the next arrives, which is also what lets each page run its own
 * entrance every time it is opened. The other six pages are code-split and
 * fetched a step ahead, so nothing is parsed until the demo is about to need it.
 *
 * **One clock.** No component here holds a timer. The sequence advances a
 * single loop clock; anything that needs elapsed time subscribes to it.
 *
 * **The visitor wins.** Touching the application stops the demo where it stands
 * and leaves the app in that state, fully usable. It is a live application with
 * a demonstration playing over it, not a video with a play button.
 */

// Only the dashboard is in the main bundle — it is what the loop opens on, and
// a page that suspends on first paint would be a blank device above the fold.
const CallsView = lazy(() =>
  import('../dashboard/views/CallsView').then((m) => ({ default: m.CallsView })),
);
const CustomersView = lazy(() =>
  import('../dashboard/views/CustomersView').then((m) => ({ default: m.CustomersView })),
);
const CustomerDetailView = lazy(() =>
  import('../dashboard/views/CustomerDetailView').then((m) => ({
    default: m.CustomerDetailView,
  })),
);
const AppointmentsView = lazy(() =>
  import('../dashboard/views/AppointmentsView').then((m) => ({ default: m.AppointmentsView })),
);
const KnowledgeView = lazy(() =>
  import('../dashboard/views/KnowledgeView').then((m) => ({ default: m.KnowledgeView })),
);
const NotificationsView = lazy(() =>
  import('../dashboard/views/NotificationsView').then((m) => ({ default: m.NotificationsView })),
);
const SettingsView = lazy(() =>
  import('../dashboard/views/SettingsView').then((m) => ({ default: m.SettingsView })),
);

const PRELOAD: Record<string, () => Promise<unknown>> = {
  calls: () => import('../dashboard/views/CallsView'),
  customers: () =>
    Promise.all([
      import('../dashboard/views/CustomersView'),
      import('../dashboard/views/CustomerDetailView'),
    ]),
  appointments: () => import('../dashboard/views/AppointmentsView'),
  knowledge: () => import('../dashboard/views/KnowledgeView'),
  notifications: () => import('../dashboard/views/NotificationsView'),
  settings: () => import('../dashboard/views/SettingsView'),
};

export function ProductDemo() {
  const kind = useDeviceKind();
  const reduced = useReducedMotion();
  const screenRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hostRef, visible] = useOnScreen();
  const [live, setLive] = useState(true);

  // Reduced motion stops the tour rather than speeding it up: the pages are
  // still there, the navigation still works, and nothing moves unless the
  // visitor moves it.
  const playing = live && visible && !reduced;
  const { state, setState, clock, restart } = useDemoSequence({ playing });
  const spot = useAutoNavigation(screenRef, scrollRef, state);
  const seconds = useDemoSeconds(clock, state.call ? state.call.since : null);

  // The page after this one, fetched while this one is still on screen.
  useEffect(() => {
    if (!playing) return;
    const next = routeAfter(clock.get()) ?? 'calls';
    void PRELOAD[next]?.();
  }, [clock, playing, state.route]);

  const takeOver = useCallback(() => setLive(false), []);

  const navigate = useCallback(
    (route: ViewId) => {
      takeOver();
      setState((current) => ({ ...current, route, customer: null, article: null, drawer: false }));
    },
    [setState, takeOver],
  );

  // The map holds *unread*, not read: absent means "as the fixture shipped".
  const isUnread = useCallback(
    (id: string) =>
      state.unread[id] ??
      [incomingNotification, ...notifications].find((item) => item.id === id)?.unread ??
      false,
    [state.unread],
  );

  const unreadCount =
    (state.arrived && isUnread(incomingNotification.id) ? 1 : 0) +
    notifications.filter((item) => isUnread(item.id)).length;

  return (
    <div ref={hostRef}>
      <DeviceFrame
        kind={kind}
        screenRef={screenRef}
        overlay={
          !playing ? null : kind === 'iphone' ? (
            <TouchRipple spot={spot} press={state.pointer.press} />
          ) : (
            <AnimatedCursor spot={spot} press={state.pointer.press} />
          )
        }
      >
        {/* Anything the visitor does to the application stops the tour. Capture
            phase, so the demo is already stopped by the time the control's own
            handler runs.

            `click`, not `pointerdown`: a finger starting a scroll gesture on
            the device is on its way past the hero, not taking the wheel, and
            pointer-down would have ended the tour for everyone who swiped
            through the page. A touch that turns into a scroll never becomes a
            click. */}
        <div className="h-full" onClickCapture={takeOver} onKeyDownCapture={takeOver}>
          <AppWindow
            ref={scrollRef}
            view={state.route}
            unreadCount={unreadCount}
            onNavigate={navigate}
            drawer={state.drawer}
            onDrawerChange={(open) => setState((current) => ({ ...current, drawer: open }))}
          >
            <PageTransition id={pageKey(state.route, state.customer, state.article)}>
              <Suspense fallback={<div className="min-h-[240px]" />}>
                {state.route === 'dashboard' && (
                  <DashboardView
                    onNavigate={navigate}
                    kpi={state.kpi}
                    fresh={state.kpi.calls > INITIAL.kpi.calls}
                  />
                )}
                {state.route === 'calls' && (
                  <CallsView live={state.call?.phase ?? null} liveSeconds={seconds} />
                )}
                {state.route === 'customers' &&
                  (state.customer ? (
                    <CustomerDetailView
                      id={state.customer}
                      onBack={() => {
                        takeOver();
                        setState((current) => ({ ...current, customer: null }));
                      }}
                    />
                  ) : (
                    <CustomersView
                      onOpen={(id) => {
                        takeOver();
                        setState((current) => ({ ...current, customer: id }));
                      }}
                    />
                  ))}
                {state.route === 'appointments' && <AppointmentsView driven={state.apptStatus} />}
                {state.route === 'knowledge' && (
                  <KnowledgeView
                    search={state.kbQuery}
                    open={state.article}
                    onOpen={(id) => {
                      takeOver();
                      setState((current) => ({ ...current, article: id }));
                    }}
                  />
                )}
                {state.route === 'notifications' && (
                  <NotificationsView
                    arrived={state.arrived}
                    isUnread={isUnread}
                    onToggle={(id) => {
                      takeOver();
                      setState((current) => ({
                        ...current,
                        unread: { ...current.unread, [id]: !isUnread(id) },
                      }));
                    }}
                    onMarkAllRead={() => {
                      takeOver();
                      setState((current) => ({
                        ...current,
                        unread: Object.fromEntries(
                          [...notifications.map((item) => item.id), incomingNotification.id].map(
                            (id) => [id, false],
                          ),
                        ),
                      }));
                    }}
                  />
                )}
                {state.route === 'settings' && (
                  <SettingsView
                    tab={state.settingsTab}
                    voice={state.voice}
                    save={state.save}
                    onTab={(tab) => {
                      takeOver();
                      setState((current) => ({ ...current, settingsTab: tab }));
                    }}
                  />
                )}
              </Suspense>
            </PageTransition>
          </AppWindow>
        </div>
      </DeviceFrame>

      {/* Offered only once the visitor has taken over, and never in their way.
          Without it there is no way back to the tour short of reloading. */}
      {!live && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => {
              restart();
              setLive(true);
            }}
            className="focus-ring rounded-full border border-mk-line-strong bg-white/[0.045] px-4 py-1.5 text-[12.5px] font-medium text-white/85 transition-colors duration-200 ease-smooth hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
          >
            Replay the tour
          </button>
        </div>
      )}
    </div>
  );
}

/** A page's identity for the transition — a profile is a page, not a state. */
function pageKey(route: ViewId, customer: string | null, article: string | null): string {
  if (route === 'customers' && customer) return `customer:${customer}`;
  if (route === 'knowledge' && article) return `article:${article}`;
  return route;
}

/**
 * Whether the device is on screen. The demo does not play to an empty room —
 * a marketing page with a rAF loop running behind three scrolled-past sections
 * is a battery complaint waiting to happen.
 */
function useOnScreen() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting) && !document.hidden),
      { threshold: 0.15 },
    );
    observer.observe(node);

    const onVisibility = () => setVisible(!document.hidden && isOnScreen(node));
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [node]);

  return [setNode, visible] as const;
}

function isOnScreen(node: HTMLElement): boolean {
  const box = node.getBoundingClientRect();
  return box.bottom > 0 && box.top < window.innerHeight;
}
