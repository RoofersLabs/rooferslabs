/**
 * Fixture data for the hero dashboard.
 *
 * The showcase is real React rendering real data structures rather than an
 * image, so the shapes here mirror the application's own domain language. Names,
 * numbers and addresses are fictional.
 */

export type CallRow = {
  id: string;
  caller: string;
  city: string;
  intent: string;
  outcome: 'booked' | 'transferred' | 'qualified';
  at: string;
};

export const OUTCOME_LABEL: Record<CallRow['outcome'], string> = {
  booked: 'Booked',
  transferred: 'Transferred',
  qualified: 'Qualified',
};

/** The feed as it stands before the scripted incoming call lands on top. */
export const CALLS: CallRow[] = [
  {
    id: 'c2',
    caller: 'Denise Okafor',
    city: 'Strongsville',
    intent: 'Active leak',
    outcome: 'transferred',
    at: '9:12',
  },
  {
    id: 'c3',
    caller: 'Ray Whitfield',
    city: 'Akron',
    intent: 'Full replacement',
    outcome: 'booked',
    at: '8:55',
  },
  {
    id: 'c4',
    caller: 'Angela Ruiz',
    city: 'Lakewood',
    intent: 'Gutter replacement',
    outcome: 'qualified',
    at: '8:20',
  },
];

/** Arrives mid-sequence, at the top of the feed. */
export const INCOMING_CALL: CallRow = {
  id: 'c1',
  caller: 'Marcus Bell',
  city: 'Parma',
  intent: 'Storm damage',
  outcome: 'booked',
  at: '9:41',
};

export type Turn = { id: string; from: 'ai' | 'caller'; text: string };

export const CONVERSATION: Turn[] = [
  { id: 'q1', from: 'ai', text: 'Summit Roofing, this is the front desk. How can I help?' },
  { id: 'q2', from: 'caller', text: 'Hail last night — shingles all over my driveway.' },
  { id: 'q3', from: 'ai', text: 'Any water coming inside right now?' },
  { id: 'q4', from: 'caller', text: 'No, just the roof.' },
  { id: 'q5', from: 'ai', text: 'Then let’s get you inspected. Thursday, 8 to 10?' },
];

export type Appointment = {
  id: string;
  time: string;
  customer: string;
  job: string;
  crew: string;
};

export const SCHEDULE: Appointment[] = [
  { id: 's1', time: '10:30', customer: 'Denise Okafor', job: 'Emergency tarp', crew: 'Crew C' },
  {
    id: 's2',
    time: '13:00',
    customer: 'Ray Whitfield',
    job: 'Replacement estimate',
    crew: 'Crew A',
  },
];

/** Slides into the schedule once the call on screen books it. */
export const BOOKED_APPOINTMENT: Appointment = {
  id: 's0',
  time: '08:00',
  customer: 'Marcus Bell',
  job: 'Storm damage inspection',
  crew: 'Crew A',
};

export type Activity = { id: string; text: string; at: string };

export const ACTIVITY: Activity[] = [
  { id: 'a2', text: 'Estimate sent to Ray Whitfield', at: '9:04' },
  { id: 'a3', text: 'Angela Ruiz added to pipeline', at: '8:22' },
];

export const NEW_ACTIVITY: Activity = {
  id: 'a1',
  text: 'Marcus Bell synced to JobNimbus',
  at: '9:43',
};

/** Call volume by hour, 7am–6pm. Drives the metrics sparkline. */
export const VOLUME = [4, 9, 14, 11, 17, 13, 8, 12, 16, 10, 6, 3];
