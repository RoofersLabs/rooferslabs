/**
 * Demonstration data for the marketing site's product preview.
 *
 * This is the marketing surface's own fixture set, not a mirror of the API
 * types — it exists to show what the product does, and it is deliberately
 * static so the preview renders identically on every visit and needs no
 * network. Names and numbers are invented.
 */

export type CallStatus = 'booked' | 'qualified' | 'emergency' | 'followup';

export type Call = {
  id: string;
  name: string;
  phone: string;
  city: string;
  time: string;
  duration: string;
  intent: string;
  status: CallStatus;
  /** Lead score, 0–100, from the qualification model. */
  score: number;
};

export const STATUS_LABEL: Record<CallStatus, string> = {
  booked: 'Booked',
  qualified: 'Qualified',
  emergency: 'Emergency',
  followup: 'Follow-up',
};

export const calls: Call[] = [
  {
    id: 'c1',
    name: 'Dana Whitfield',
    phone: '(614) 555-0182',
    city: 'Dublin, OH',
    time: '2:41 AM',
    duration: '3m 12s',
    intent: 'Storm damage — active leak',
    status: 'emergency',
    score: 96,
  },
  {
    id: 'c2',
    name: 'Marcus Bell',
    phone: '(614) 555-0143',
    city: 'Westerville, OH',
    time: '8:05 AM',
    duration: '2m 48s',
    intent: 'Full roof replacement quote',
    status: 'booked',
    score: 91,
  },
  {
    id: 'c3',
    name: 'Priya Raman',
    phone: '(614) 555-0119',
    city: 'Hilliard, OH',
    time: '9:22 AM',
    duration: '1m 57s',
    intent: 'Missing shingles after wind',
    status: 'booked',
    score: 84,
  },
  {
    id: 'c4',
    name: 'Tom Alvarez',
    phone: '(614) 555-0167',
    city: 'Grove City, OH',
    time: '10:14 AM',
    duration: '1m 20s',
    intent: 'Gutter repair estimate',
    status: 'qualified',
    score: 72,
  },
  {
    id: 'c5',
    name: 'Renee Okafor',
    phone: '(614) 555-0198',
    city: 'Powell, OH',
    time: '11:03 AM',
    duration: '2m 05s',
    intent: 'Insurance claim inspection',
    status: 'followup',
    score: 68,
  },
  {
    id: 'c6',
    name: 'Chris Donnelly',
    phone: '(614) 555-0155',
    city: 'Reynoldsburg, OH',
    time: '12:37 PM',
    duration: '2m 31s',
    intent: 'Flat roof leak over garage',
    status: 'booked',
    score: 79,
  },
  {
    id: 'c7',
    name: 'Alma Vasquez',
    phone: '(614) 555-0126',
    city: 'Upper Arlington, OH',
    time: '1:48 PM',
    duration: '1m 44s',
    intent: 'Skylight resealing',
    status: 'qualified',
    score: 64,
  },
];

/** Keyed by call id. Rendered as a replayed transcript, one line at a time. */
export const transcripts: Record<string, Array<{ role: 'ai' | 'caller'; text: string }>> = {
  c1: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. This is the after-hours line.' },
    { role: 'caller', text: 'There is water coming through my ceiling right now.' },
    { role: 'ai', text: 'That is an emergency. Is the water still actively coming in?' },
    { role: 'caller', text: 'Yes, into a bucket in the hallway.' },
    { role: 'ai', text: 'Understood. Is anyone able to move what is underneath it safely?' },
    { role: 'caller', text: 'Already did. It is just the bucket and a towel now.' },
    { role: 'ai', text: 'I am paging the on-call crew now and holding a 7 AM slot for you.' },
    { role: 'caller', text: 'Thank you. I did not expect anyone to pick up.' },
  ],
  c2: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'I need a quote on replacing the whole roof.' },
    { role: 'ai', text: 'Happy to help. Do you know roughly how old the current roof is?' },
    { role: 'caller', text: 'About twenty-two years, original to the house.' },
    { role: 'ai', text: 'That tracks. Are you seeing any staining on the ceilings inside?' },
    { role: 'caller', text: 'Not yet, I would just rather get ahead of it.' },
    { role: 'ai', text: 'Sensible. I can get an estimator out Thursday morning — does 10 work?' },
    { role: 'caller', text: 'Thursday at ten is fine.' },
    { role: 'ai', text: 'Booked. You will get a text confirmation in the next minute.' },
  ],
  c3: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'The wind took some shingles off the back side.' },
    { role: 'ai', text: 'Any ceiling stains or drips inside the house?' },
    { role: 'caller', text: 'No, nothing inside.' },
    { role: 'ai', text: 'Good. I have you down for Wednesday at 1 PM for an inspection.' },
  ],
  c4: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'Looking for a price on new gutters.' },
    { role: 'ai', text: 'Is this for the full perimeter or one section?' },
    { role: 'caller', text: 'Just the front of the house.' },
    { role: 'ai', text: 'Got it. An estimator will call you back within the hour.' },
  ],
  c5: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'My insurer wants an inspection report for a hail claim.' },
    { role: 'ai', text: 'We do those. Do you have a claim number handy?' },
    { role: 'caller', text: 'I can find it, give me a moment.' },
    { role: 'ai', text: 'No rush — I will text you a link to upload it.' },
  ],
  c6: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'The flat roof over my garage is leaking again.' },
    { role: 'ai', text: 'Has it been patched before, or would this be the first repair?' },
    { role: 'caller', text: 'Patched twice. It keeps coming back in the same corner.' },
    { role: 'ai', text: 'Then it is worth a proper look. Monday at 9 AM — shall I hold it?' },
    { role: 'caller', text: 'Please do.' },
  ],
  c7: [
    { role: 'ai', text: 'Thanks for calling Summit Roofing. How can I help?' },
    { role: 'caller', text: 'One of my skylights is letting in water when it rains hard.' },
    { role: 'ai', text: 'Do you know how old the skylight is?' },
    { role: 'caller', text: 'It came with the house, so at least fifteen years.' },
    {
      role: 'ai',
      text: 'Resealing usually handles that. I will have an estimator call you today.',
    },
  ],
};

/**
 * Indexed access into a fixture list.
 *
 * The project compiles with `noUncheckedIndexedAccess`, which is right for API
 * data but noisy against hand-written fixtures. This narrows the type in one
 * place and fails loudly if a fixture is ever emptied, rather than scattering
 * non-null assertions through the components.
 */
export function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) {
    throw new Error(`Preview fixture is missing index ${index}`);
  }
  return value;
}

/** The call the hero and the summary panels open on. */
export const featuredCall = at(calls, 1);

export type Appointment = {
  id: string;
  name: string;
  service: string;
  day: string;
  time: string;
  address: string;
  crew: string;
};

export const appointments: Appointment[] = [
  {
    id: 'a1',
    name: 'Dana Whitfield',
    service: 'Emergency tarp + assessment',
    day: 'Today',
    time: '7:00 AM',
    address: '418 Bridge St',
    crew: 'On-call crew',
  },
  {
    id: 'a2',
    name: 'Priya Raman',
    service: 'Wind damage inspection',
    day: 'Wed',
    time: '1:00 PM',
    address: '2201 Cemetery Rd',
    crew: 'Crew B',
  },
  {
    id: 'a3',
    name: 'Marcus Bell',
    service: 'Full replacement estimate',
    day: 'Thu',
    time: '10:00 AM',
    address: '79 Sunbury Rd',
    crew: 'Estimating',
  },
  {
    id: 'a4',
    name: 'Louis Trent',
    service: 'Annual maintenance',
    day: 'Fri',
    time: '3:30 PM',
    address: '1140 Hayden Run',
    crew: 'Crew A',
  },
];

/** Days carrying at least one booking, for the calendar heat marks. */
export const bookedDays: Record<number, number> = {
  9: 1,
  11: 2,
  12: 3,
  13: 1,
  16: 2,
  17: 4,
  18: 2,
  19: 1,
  23: 3,
  24: 1,
};

export type TimelineEvent = {
  id: string;
  label: string;
  detail: string;
  time: string;
  kind: 'call' | 'ai' | 'booking' | 'message' | 'job';
};

export const timeline: TimelineEvent[] = [
  {
    id: 't1',
    label: 'Call answered',
    detail: 'Inbound at 2:41 AM, picked up on the first ring',
    time: '2:41 AM',
    kind: 'call',
  },
  {
    id: 't2',
    label: 'Qualified as emergency',
    detail: 'Active interior water intrusion confirmed',
    time: '2:43 AM',
    kind: 'ai',
  },
  {
    id: 't3',
    label: 'On-call crew paged',
    detail: 'SMS + push delivered to two responders',
    time: '2:44 AM',
    kind: 'message',
  },
  {
    id: 't4',
    label: 'Appointment booked',
    detail: 'Today at 7:00 AM — emergency tarp + assessment',
    time: '2:44 AM',
    kind: 'booking',
  },
  {
    id: 't5',
    label: 'Crew dispatched',
    detail: 'Marked en route from the Dublin yard',
    time: '6:31 AM',
    kind: 'job',
  },
];

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  urgent?: boolean;
};

export const notifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Emergency call routed',
    detail: 'Dana Whitfield — active leak, crew paged',
    time: 'now',
    urgent: true,
  },
  { id: 'n2', title: 'Appointment booked', detail: 'Marcus Bell — Thu 10:00 AM', time: '2m' },
  { id: 'n3', title: 'Estimate sent', detail: 'Priya Raman — wind damage', time: '18m' },
  { id: 'n4', title: 'Follow-up scheduled', detail: 'Renee Okafor — claim documents', time: '1h' },
];

/** Calls answered per day, Monday through Sunday. */
export const weekVolume = [34, 41, 38, 52, 47, 29, 22];
export const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const metrics = [
  { label: 'Calls answered', value: '263', delta: '+12%' },
  { label: 'Appointments booked', value: '88', delta: '+9%' },
  { label: 'Answer rate', value: '100%', delta: null },
  { label: 'Avg. pickup', value: '0.8s', delta: '−0.2s' },
];

/** Live-activity ticker entries, replayed on a loop in the preview. */
export const activity = [
  { id: 'l1', text: 'Call answered — Bexley, OH', meta: 'first ring' },
  { id: 'l2', text: 'Lead qualified — roof replacement', meta: 'score 91' },
  { id: 'l3', text: 'Appointment booked — Thu 10:00 AM', meta: 'Crew B' },
  { id: 'l4', text: 'Owner notified — push + SMS', meta: 'delivered' },
  { id: 'l5', text: 'Call answered — Gahanna, OH', meta: 'first ring' },
  { id: 'l6', text: 'Emergency routed — active leak', meta: 'on-call paged' },
];

/** The qualification checklist the model fills in during a call. */
export const qualification = [
  { label: 'Homeowner confirmed', value: 'Yes' },
  { label: 'Property type', value: 'Single family' },
  { label: 'Roof age', value: '22 years' },
  { label: 'Service area', value: 'In range' },
  { label: 'Insurance claim', value: 'No' },
  { label: 'Ready to schedule', value: 'Yes' },
];
