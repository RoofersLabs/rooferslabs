/**
 * Fixture data for the live product components.
 *
 * These are not screenshots — every panel on this page is real React rendering
 * real data structures, so the marketing site cannot drift out of date the way
 * a PNG does. The shapes deliberately mirror the application's own domain
 * language (call outcomes, lead grades, job types) so the mock stays honest.
 *
 * Names, numbers and addresses are fictional.
 */

/**
 * Kept to exactly the outcomes the call log offers a filter for, and to five
 * rows — the number that fits the panel without the last one being sliced in
 * half by the scroll container.
 */
export type CallOutcome = 'booked' | 'qualified' | 'transferred';

export type CallRecord = {
  id: string;
  caller: string;
  phone: string;
  location: string;
  job: string;
  outcome: CallOutcome;
  duration: string;
  time: string;
};

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: 'Appointment booked',
  qualified: 'Lead qualified',
  transferred: 'Transferred',
};

export const CALLS: CallRecord[] = [
  {
    id: 'c1',
    caller: 'Marcus Bell',
    phone: '(216) 555-0148',
    location: 'Parma, OH',
    job: 'Storm damage inspection',
    outcome: 'booked',
    duration: '2:14',
    time: '9:41 AM',
  },
  {
    id: 'c2',
    caller: 'Denise Okafor',
    phone: '(440) 555-0193',
    location: 'Strongsville, OH',
    job: 'Active leak — second floor',
    outcome: 'transferred',
    duration: '0:48',
    time: '9:12 AM',
  },
  {
    id: 'c3',
    caller: 'Ray Whitfield',
    phone: '(330) 555-0117',
    location: 'Akron, OH',
    job: 'Full roof replacement estimate',
    outcome: 'booked',
    duration: '3:02',
    time: '8:55 AM',
  },
  {
    id: 'c4',
    caller: 'Angela Ruiz',
    phone: '(216) 555-0172',
    location: 'Lakewood, OH',
    job: 'Gutter replacement',
    outcome: 'qualified',
    duration: '1:37',
    time: '8:20 AM',
  },
  {
    id: 'c5',
    caller: 'Tom Hargrove',
    phone: '(440) 555-0106',
    location: 'Elyria, OH',
    job: 'Missing shingles after wind',
    outcome: 'booked',
    duration: '2:41',
    time: '7:58 AM',
  },
];

export type Appointment = {
  id: string;
  customer: string;
  job: string;
  crew: string;
  window: string;
  day: string;
  urgent?: boolean;
};

export const APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    customer: 'Marcus Bell',
    job: 'Storm damage inspection',
    crew: 'Crew A · Devon',
    window: '8:00 – 10:00',
    day: 'Today',
  },
  {
    id: 'a2',
    customer: 'Denise Okafor',
    job: 'Emergency leak — tarp & assess',
    crew: 'Crew C · Luis',
    window: '10:30 – 12:00',
    day: 'Today',
    urgent: true,
  },
  {
    id: 'a3',
    customer: 'Ray Whitfield',
    job: 'Replacement estimate',
    crew: 'Crew A · Devon',
    window: '1:00 – 2:30',
    day: 'Tomorrow',
  },
  {
    id: 'a4',
    customer: 'Tom Hargrove',
    job: 'Shingle repair',
    crew: 'Crew B · Marta',
    window: '3:00 – 4:30',
    day: 'Tomorrow',
  },
];

export type TranscriptTurn = {
  id: string;
  speaker: 'caller' | 'ai';
  text: string;
  /** Shown beneath an AI turn to expose what the model actually did. */
  reasoning?: string;
};

export const TRANSCRIPT: TranscriptTurn[] = [
  {
    id: 't1',
    speaker: 'ai',
    text: "Thanks for calling Summit Roofing — this is the front desk. How can I help?",
  },
  {
    id: 't2',
    speaker: 'caller',
    text: "We had that hail come through last night and there's shingles all over the driveway.",
  },
  {
    id: 't3',
    speaker: 'ai',
    text: "Sorry to hear that. Is any water coming inside the house right now?",
    reasoning: 'Triaging for emergency — active water intrusion routes straight to an owner.',
  },
  {
    id: 't4',
    speaker: 'caller',
    text: "No, nothing inside. Just the roof itself.",
  },
  {
    id: 't5',
    speaker: 'ai',
    text: "Good — that means we can book a proper inspection rather than an emergency call. We cover Parma, and hail claims are usually insurance-eligible. Does Thursday morning work?",
    reasoning: 'Service area confirmed · Job type: storm damage · Insurance path flagged',
  },
  {
    id: 't6',
    speaker: 'caller',
    text: 'Thursday morning is fine.',
  },
  {
    id: 't7',
    speaker: 'ai',
    text: "Booked — Thursday 8 to 10 with Devon. You'll get a text confirmation in a moment.",
    reasoning: 'Appointment written to calendar · Crew A assigned · SMS confirmation queued',
  },
];

export type AnalyticsBar = { label: string; value: number };

/** Calls answered per weekday. The tallest bar is Monday — post-weekend backlog. */
export const CALL_VOLUME: AnalyticsBar[] = [
  { label: 'M', value: 78 },
  { label: 'T', value: 61 },
  { label: 'W', value: 66 },
  { label: 'T', value: 54 },
  { label: 'F', value: 71 },
  { label: 'S', value: 39 },
  { label: 'S', value: 24 },
];

export type KnowledgeEntry = { question: string; answer: string; source: string };

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    question: 'Do you work with insurance claims?',
    answer:
      'Yes — we document damage for the adjuster and can meet them on site at no extra charge.',
    source: 'Company policy · Claims',
  },
  {
    question: 'How far out are you booking?',
    answer: 'Inspections within 3 business days. Replacements are currently 2–3 weeks out.',
    source: 'Live from scheduling',
  },
  {
    question: 'What areas do you cover?',
    answer: 'Cuyahoga, Lorain, Summit and Medina counties. Anything past that we refer out.',
    source: 'Service area',
  },
  {
    question: 'Is there a charge for an estimate?',
    answer: 'Estimates are free. Emergency tarping is billed at the storm-response rate.',
    source: 'Pricing',
  },
];
