import type { ViewId } from '../dashboard/chrome';
import { incomingNotification, notifications } from '../dashboard/data';

/**
 * The script.
 *
 * Everything the showcase does is in this file: which page is open, what the
 * cursor is reaching for, when a call comes in, which figures move. It is a
 * flat list of timestamped actions applied to one reducer, so the demo is
 * deterministic — every visitor sees the same twenty-one seconds, and any frame
 * of it can be reproduced from a single number.
 *
 * There are deliberately no timers anywhere else. A component that wanted its
 * own `setInterval` would drift out of step with this within a couple of loops,
 * and the whole point of a product demo is that the cursor lands on the button
 * at the moment the page changes.
 */

export type CallPhase = 'ringing' | 'answered' | 'talking' | 'captured' | 'logged';
export type SettingsTab = 'business' | 'hours' | 'ai' | 'phone';
export type KpiKey = 'calls' | 'leads' | 'emergencies' | 'appointments';

export type DemoState = {
  route: ViewId;
  /** Open on a handset only — the demo drives it to reach the drawer's rows. */
  drawer: boolean;
  kpi: Record<KpiKey, number>;
  /** The call being handled right now, or null between calls. */
  call: { phase: CallPhase; since: number } | null;
  /** Notification id → *unread*. Absent means "as shipped". */
  unread: Record<string, boolean>;
  /** Whether the emergency notification has arrived yet this loop. */
  arrived: boolean;
  /** Which customer profile is open over the list. */
  customer: string | null;
  kbQuery: string;
  article: string | null;
  apptStatus: Record<string, string>;
  settingsTab: SettingsTab;
  voice: string;
  save: 'idle' | 'saving' | 'saved';
  /**
   * What the cursor is reaching for, named by `data-demo-target`. `press`
   * counts taps rather than describing one, so two taps on the same control are
   * two events.
   */
  pointer: { target: string | null; press: number };
  /** Scroll request for the page container; `seq` re-fires an identical offset. */
  scroll: { top: number; seq: number };
};

export const INITIAL: DemoState = {
  route: 'dashboard',
  drawer: false,
  kpi: { calls: 47, leads: 18, emergencies: 3, appointments: 9 },
  call: null,
  unread: {},
  arrived: false,
  customer: null,
  kbQuery: '',
  article: null,
  apptStatus: {},
  settingsTab: 'business',
  voice: 'Ember',
  save: 'idle',
  pointer: { target: null, press: 0 },
  scroll: { top: 0, seq: 0 },
};

type Action =
  | { type: 'reset' }
  | { type: 'nav'; route: ViewId }
  | { type: 'drawer'; open: boolean }
  | { type: 'point'; target: string | null }
  | { type: 'press' }
  | { type: 'kpi'; key: KpiKey; by: number }
  | { type: 'call'; phase: CallPhase }
  | { type: 'arrive' }
  | { type: 'readAll' }
  | { type: 'customer'; id: string | null }
  | { type: 'kb'; query: string }
  | { type: 'article'; id: string | null }
  | { type: 'appt'; id: string; status: string }
  | { type: 'tab'; tab: SettingsTab }
  | { type: 'voice'; voice: string }
  | { type: 'save'; state: DemoState['save'] }
  | { type: 'scroll'; top: number };

export type Beat = { at: number; action: Action };

/**
 * Applies one action. Pure, and the only place demo state is written.
 *
 * `at` is the loop clock, so anything that needs to measure elapsed time —
 * a call's duration counter — records its own start rather than reading a
 * wall clock later.
 */
export function reduce(state: DemoState, action: Action, at: number): DemoState {
  switch (action.type) {
    case 'reset':
      // The pointer survives the loop. It is the one thing on screen that
      // belongs to the visitor rather than to the demo, and snapping it back to
      // the corner every twenty seconds is the tell that this is a recording.
      return { ...INITIAL, pointer: state.pointer };
    case 'nav':
      // Navigating leaves whatever was open on the page behind, exactly as
      // routing does: the customer profile and the article are child routes.
      return { ...state, route: action.route, drawer: false, customer: null, article: null };
    case 'drawer':
      return { ...state, drawer: action.open };
    case 'point':
      return { ...state, pointer: { ...state.pointer, target: action.target } };
    case 'press':
      return { ...state, pointer: { ...state.pointer, press: state.pointer.press + 1 } };
    case 'kpi':
      return { ...state, kpi: { ...state.kpi, [action.key]: state.kpi[action.key] + action.by } };
    case 'call':
      return {
        ...state,
        call: { phase: action.phase, since: state.call?.since ?? at },
      };
    case 'arrive':
      return { ...state, arrived: true };
    case 'readAll':
      return {
        ...state,
        unread: Object.fromEntries(
          [...notifications.map((item) => item.id), incomingNotification.id].map((id) => [
            id,
            false,
          ]),
        ),
      };
    case 'customer':
      return { ...state, customer: action.id };
    case 'kb':
      return { ...state, kbQuery: action.query };
    case 'article':
      return { ...state, article: action.id };
    case 'appt':
      return { ...state, apptStatus: { ...state.apptStatus, [action.id]: action.status } };
    case 'tab':
      return { ...state, settingsTab: action.tab, save: 'idle' };
    case 'voice':
      return { ...state, voice: action.voice, save: 'idle' };
    case 'save':
      return { ...state, save: action.state };
    case 'scroll':
      return { ...state, scroll: { top: action.top, seq: state.scroll.seq + 1 } };
  }
}

/* ── Authoring helpers ───────────────────────────────────────────────────── */

const beats = (at: number, ...actions: Action[]): Beat[] =>
  actions.map((action) => ({ at, action }));

/**
 * A control being clicked: the cursor arrives, settles, then presses.
 *
 * The gap is what makes it read as a person rather than a script. Landing and
 * clicking on the same frame looks like the page changed on its own.
 */
const click = (at: number, target: string, ...then: Action[]): Beat[] => [
  ...beats(at - 480, { type: 'point', target }),
  ...beats(at, { type: 'press' }, ...then),
];

/** One beat per character, so the field fills the way a field fills. */
const type_ = (from: number, text: string, per = 65): Beat[] =>
  [...text].map((_, index) => ({
    at: from + (index + 1) * per,
    action: { type: 'kb', query: text.slice(0, index + 1) } as Action,
  }));

/* ── The loop ────────────────────────────────────────────────────────────── */

/** Total loop length. The whole demo is this long and then it is this long again. */
export const LOOP = 21_600;

/**
 * Dashboard → Calls → Customers → Appointments → Knowledge Base →
 * Notifications → Settings → Dashboard.
 *
 * Roughly three seconds a page: long enough to read the heading and watch one
 * thing happen, short enough that a visitor who arrived for the pricing sees
 * the whole product before they scroll past.
 */
export const TIMELINE: Beat[] = [
  /* Dashboard — the day filling in. */
  ...beats(0, { type: 'reset' }, { type: 'scroll', top: 0 }),
  ...beats(1100, { type: 'kpi', key: 'calls', by: 1 }),
  ...beats(1450, { type: 'kpi', key: 'leads', by: 1 }),
  ...beats(1950, { type: 'kpi', key: 'appointments', by: 1 }),
  ...click(2800, 'nav:calls', { type: 'nav', route: 'calls' }),

  /* Calls — one conversation, start to finish. */
  ...beats(3400, { type: 'call', phase: 'ringing' }),
  ...beats(4050, { type: 'call', phase: 'answered' }),
  ...beats(4750, { type: 'call', phase: 'talking' }),
  ...beats(5450, { type: 'call', phase: 'captured' }, { type: 'kpi', key: 'emergencies', by: 1 }),
  ...beats(5950, { type: 'call', phase: 'logged' }),
  ...click(6450, 'nav:customers', { type: 'nav', route: 'customers' }),

  /* Customers — the record behind the call. */
  ...click(7300, 'row:u1', { type: 'customer', id: 'u1' }),
  ...beats(8300, { type: 'scroll', top: 320 }),
  ...beats(9100, { type: 'scroll', top: 620 }),
  ...click(
    9800,
    'nav:appointments',
    { type: 'nav', route: 'appointments' },
    {
      type: 'scroll',
      top: 0,
    },
  ),

  /* Appointments — a request becoming a confirmed visit. */
  ...click(10800, 'appt:a3', { type: 'appt', id: 'a3', status: 'CONFIRMED' }),
  ...beats(11500, { type: 'scroll', top: 220 }),
  ...click(12300, 'nav:knowledge', { type: 'nav', route: 'knowledge' }, { type: 'scroll', top: 0 }),

  /* Knowledge base — what the receptionist answers from. */
  ...click(13100, 'kb:search'),
  ...type_(13150, 'roof leak'),
  ...click(14500, 'article:k1', { type: 'article', id: 'k1' }),
  ...click(15450, 'article:back', { type: 'article', id: null }),
  ...click(15950, 'nav:notifications', { type: 'nav', route: 'notifications' }),

  /* Notifications — a live event landing while you watch. */
  ...beats(16700, { type: 'arrive' }),
  ...click(17600, 'action:mark-all', { type: 'readAll' }),
  ...click(18300, 'nav:settings', { type: 'nav', route: 'settings' }),

  /* Settings — a change, saved. */
  ...click(19100, 'settings:ai', { type: 'tab', tab: 'ai' }),
  ...click(19900, 'field:voice', { type: 'voice', voice: 'Aurora' }),
  ...click(20600, 'settings:save', { type: 'save', state: 'saving' }),
  ...beats(21000, { type: 'save', state: 'saved' }),

  /* And round again. The click lands in the last frames of the loop and the
     reset at zero answers it, so the dashboard arrives already empty and
     counts itself up — rather than being reset in front of the visitor a
     moment after they watched it fill in. */
  ...click(21560, 'nav:dashboard'),
]
  .filter((beat) => beat.at >= 0 && beat.at < LOOP)
  .sort((a, b) => a.at - b.at);

/**
 * The route the demo will be on next, for preloading its page a step ahead.
 * Derived from the timeline rather than restated, so it cannot fall out of step
 * with the script above.
 */
export function routeAfter(now: number): ViewId | null {
  const next = TIMELINE.find((beat) => beat.at > now && beat.action.type === 'nav');
  return next && next.action.type === 'nav' ? next.action.route : null;
}
