/**
 * Demonstration data for the marketing site's product preview.
 *
 * This is the marketing surface's own fixture set, not a mirror of the API
 * types — it exists to show what the product does, and it is deliberately
 * static so the preview renders identically on every visit and needs no
 * network. Company, callers and numbers are invented.
 *
 * Status values are written as the product's real enum strings (`EMERGENCY`,
 * `APPOINTMENT_REQUESTED`, `HOT`…) rather than as pre-formatted labels, so the
 * preview can run them through the same `humanizeEnum` and the same
 * `EnumStatusText` tone rules the authenticated pages use. A caller who is
 * orange in the app is orange here, because it is literally the same rule.
 *
 * Relative times are written out instead of derived from `Date.now()`. The
 * dashboard's own `timeAgo` is right for live records; here it would make every
 * screenshot, every visual diff and every page load slightly different for no
 * gain.
 */

/** The fictional business the preview is signed in as. */
export const COMPANY = {
  name: 'Summit Roofing',
  /** The signed-in owner — the greeting is addressed to them. */
  firstName: 'Ray',
  initials: 'RS',
  host: 'app.rooferslabs.com',
} as const;

/* ── Calls ───────────────────────────────────────────────────────────────── */

export type PreviewCall = {
  id: string;
  name: string;
  /** E.164, so the preview formats it through the product's own `formatPhone`. */
  phone: string;
  city: string;
  /** `ConversationOutcome` — drives the status colour. */
  outcome: string;
  /** `ConversationIntent` — what the Top insights panel counts. */
  intent: string;
  summary: string;
  duration: string;
  /** Pre-rendered `timeAgo` output. */
  ago: string;
  /** Pre-rendered `formatDateTime` output, for the Calls table. */
  at: string;
  isEmergency: boolean;
};

export const calls: PreviewCall[] = [
  {
    id: 'c1',
    name: 'Dana Whitfield',
    phone: '+16145550182',
    city: 'Dublin, OH',
    outcome: 'EMERGENCY',
    intent: 'EMERGENCY_REPAIR',
    summary:
      'Water coming through the kitchen ceiling after last night’s storm. On-call crew paged and an emergency tarp booked for 7:00 AM.',
    duration: '3m 12s',
    ago: '12 minutes ago',
    at: 'Today, 2:41 AM',
    isEmergency: true,
  },
  {
    id: 'c2',
    name: 'Marcus Bell',
    phone: '+16145550143',
    city: 'Westerville, OH',
    outcome: 'APPOINTMENT_REQUESTED',
    intent: 'NEW_ESTIMATE',
    summary:
      'Twenty-two year old architectural shingle roof, no interior staining yet. Estimate booked for Thursday at 10:00 AM.',
    duration: '2m 48s',
    ago: '38 minutes ago',
    at: 'Today, 8:05 AM',
    isEmergency: false,
  },
  {
    id: 'c3',
    name: 'Priya Raman',
    phone: '+16145550119',
    city: 'Hilliard, OH',
    outcome: 'APPOINTMENT_REQUESTED',
    intent: 'INSPECTION',
    summary:
      'Wind lifted shingles off the rear slope. Nothing coming through inside. Inspection booked for Wednesday at 1:00 PM.',
    duration: '1m 57s',
    ago: '1 hour ago',
    at: 'Today, 9:22 AM',
    isEmergency: false,
  },
  {
    id: 'c4',
    name: 'Tom Alvarez',
    phone: '+16145550167',
    city: 'Grove City, OH',
    outcome: 'LEAD_CAPTURED',
    intent: 'NEW_ESTIMATE',
    summary:
      'Gutter replacement across the front elevation only. In service area, ready to schedule. Estimator calling back within the hour.',
    duration: '1m 20s',
    ago: '2 hours ago',
    at: 'Today, 10:14 AM',
    isEmergency: false,
  },
  {
    id: 'c5',
    name: 'Renee Okafor',
    phone: '+16145550198',
    city: 'Powell, OH',
    outcome: 'LEAD_CAPTURED',
    intent: 'INSPECTION',
    summary:
      'Insurer has asked for a hail damage inspection report. Claim number to follow by text; upload link already sent.',
    duration: '2m 05s',
    ago: '3 hours ago',
    at: 'Today, 11:03 AM',
    isEmergency: false,
  },
  {
    id: 'c6',
    name: 'Chris Donnelly',
    phone: '+16145550155',
    city: 'Reynoldsburg, OH',
    outcome: 'APPOINTMENT_REQUESTED',
    intent: 'REPAIR',
    summary:
      'Flat roof over the garage leaking in the same corner after two patches. Repair visit held for Monday at 9:00 AM.',
    duration: '2m 31s',
    ago: '4 hours ago',
    at: 'Today, 12:37 PM',
    isEmergency: false,
  },
  {
    id: 'c7',
    name: 'Alma Vasquez',
    phone: '+16145550126',
    city: 'Upper Arlington, OH',
    outcome: 'INFORMATION_PROVIDED',
    intent: 'WARRANTY',
    summary:
      'Asked what the workmanship warranty covers on a skylight reseal. Answered from the knowledge base; calling back after HOA approval.',
    duration: '1m 44s',
    ago: '5 hours ago',
    at: 'Today, 1:48 PM',
    isEmergency: false,
  },
  {
    id: 'c8',
    name: 'Wes Carmichael',
    phone: '+16145550171',
    city: 'Gahanna, OH',
    outcome: 'LEAD_CAPTURED',
    intent: 'REPAIR',
    summary:
      'Cracked ridge cap spotted from the driveway. Wants a repair quote before the next storm; prefers callbacks after 5 PM.',
    duration: '1m 08s',
    ago: '6 hours ago',
    at: 'Today, 2:26 PM',
    isEmergency: false,
  },
];

/* ── Dashboard metrics ───────────────────────────────────────────────────── */

/**
 * The four headline figures, in the order the production analytics panel puts
 * them. `delta` fills the panel's comparison slot — the only place the preview
 * carries a value the live product currently renders as a dash, because an
 * empty comparison line is exactly the empty state this preview exists to
 * avoid.
 */
export const metrics = [
  { key: 'calls', label: 'Calls today', value: 47, delta: '+12%' },
  { key: 'leads', label: 'Leads today', value: 18, delta: '+9%' },
  { key: 'emergencies', label: 'Emergencies today', value: 3, delta: '+1' },
  { key: 'appointments', label: 'Pending appointments', value: 9, delta: '+4' },
] as const;

/** The AI receptionist summary tiles, matching the product's four. */
export const summaryTiles = [
  { key: 'resolution', label: 'Resolution rate', value: '94%', hint: '44 of 47 calls today' },
  { key: 'length', label: 'Avg. call length', value: '2m 41s', hint: 'Across 47 calls today' },
  { key: 'hours', label: 'Hours saved', value: '6.8h', hint: '≈ 152 calls this week' },
  { key: 'missed', label: 'Missed calls', value: '0', hint: 'Answered on the first ring' },
] as const;

/** Ranked share of what recent callers wanted, by detected intent. */
export const insightRows = [
  { label: 'New estimate', percent: 34 },
  { label: 'Emergency repair', percent: 24 },
  { label: 'Repair', percent: 18 },
  { label: 'Inspection', percent: 14 },
  { label: 'Warranty', percent: 10 },
] as const;

/* ── Appointments ────────────────────────────────────────────────────────── */

export type PreviewAppointment = {
  id: string;
  name: string;
  service: string;
  /** `AppointmentPriority`. */
  priority: string;
  /** `AppointmentStatus`. */
  status: string;
  /** Pre-rendered `formatDate` / `formatDateTime` output. */
  when: string;
  window: string;
  address: string;
  requested: string;
};

export const appointments: PreviewAppointment[] = [
  {
    id: 'a1',
    name: 'Dana Whitfield',
    service: 'Emergency tarp + interior assessment',
    priority: 'URGENT',
    status: 'CONFIRMED',
    when: 'Today',
    window: '7:00 – 9:00 AM',
    address: '418 Bridge St, Dublin',
    requested: '12 minutes ago',
  },
  {
    id: 'a2',
    name: 'Priya Raman',
    service: 'Wind damage inspection',
    priority: 'HIGH',
    status: 'CONFIRMED',
    when: 'Wed 14 Aug',
    window: '1:00 – 3:00 PM',
    address: '2201 Cemetery Rd, Hilliard',
    requested: '1 hour ago',
  },
  {
    id: 'a3',
    name: 'Marcus Bell',
    service: 'Full replacement estimate',
    priority: 'HIGH',
    status: 'REQUESTED',
    when: 'Thu 15 Aug',
    window: '10:00 AM – 12:00 PM',
    address: '79 Sunbury Rd, Westerville',
    requested: '38 minutes ago',
  },
  {
    id: 'a4',
    name: 'Chris Donnelly',
    service: 'Flat roof leak repair',
    priority: 'NORMAL',
    status: 'REQUESTED',
    when: 'Mon 19 Aug',
    window: '9:00 – 11:00 AM',
    address: '5522 Blacklick Dr, Reynoldsburg',
    requested: '4 hours ago',
  },
  {
    id: 'a5',
    name: 'Louise Trent',
    service: 'Annual maintenance visit',
    priority: 'LOW',
    status: 'CONFIRMED',
    when: 'Fri 16 Aug',
    window: '3:30 – 5:00 PM',
    address: '1140 Hayden Run, Hilliard',
    requested: 'Yesterday',
  },
];

/* ── Customers ───────────────────────────────────────────────────────────── */

export type PreviewCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  /** `PropertyType`. */
  propertyType: string;
  /** `CustomerStatus`. */
  status: string;
  added: string;
  favorite?: boolean;
  /** Where the record came from, as the detail page's profile row shows it. */
  leadSource: string;
  roofAge: string;
  since: string;
  /** Ids into `calls`, newest first — the profile's contact history. */
  history: string[];
  /** Id into `appointments`, when one is booked. */
  appointmentId?: string;
};

export const customers: PreviewCustomer[] = [
  {
    id: 'u1',
    name: 'Dana Whitfield',
    phone: '+16145550182',
    email: 'dana.whitfield@example.com',
    address: '418 Bridge St, Dublin',
    propertyType: 'RESIDENTIAL',
    status: 'ACTIVE',
    added: '12 minutes ago',
    favorite: true,
    leadSource: 'Inbound call',
    roofAge: 'Asphalt shingle · 14 years',
    since: '14 Mar 2024',
    history: ['c1'],
    appointmentId: 'a1',
  },
  {
    id: 'u2',
    name: 'Marcus Bell',
    phone: '+16145550143',
    email: 'm.bell@example.com',
    address: '79 Sunbury Rd, Westerville',
    propertyType: 'RESIDENTIAL',
    status: 'NEW',
    added: '38 minutes ago',
    leadSource: 'Inbound call',
    roofAge: 'Architectural shingle · 22 years',
    since: 'Today',
    history: ['c2'],
    appointmentId: 'a3',
  },
  {
    id: 'u3',
    name: 'Priya Raman',
    phone: '+16145550119',
    email: 'praman@example.com',
    address: '2201 Cemetery Rd, Hilliard',
    propertyType: 'RESIDENTIAL',
    status: 'ACTIVE',
    added: '1 hour ago',
    leadSource: 'Storm campaign',
    roofAge: 'Asphalt shingle · 9 years',
    since: '2 Nov 2023',
    history: ['c3'],
    appointmentId: 'a2',
  },
  {
    id: 'u4',
    name: 'Grove City Storage Co.',
    phone: '+16145550167',
    email: 'facilities@gcstorage.example',
    address: '3900 Southwest Blvd, Grove City',
    propertyType: 'COMMERCIAL',
    status: 'ACTIVE',
    added: '2 hours ago',
    favorite: true,
    leadSource: 'Referral',
    roofAge: 'TPO membrane · 6 years',
    since: '9 Jan 2023',
    history: ['c4'],
  },
  {
    id: 'u5',
    name: 'Renee Okafor',
    phone: '+16145550198',
    email: 'renee.okafor@example.com',
    address: '867 Liberty Rd, Powell',
    propertyType: 'RESIDENTIAL',
    status: 'NEW',
    added: '3 hours ago',
    leadSource: 'Insurance claim',
    roofAge: 'Asphalt shingle · 11 years',
    since: 'Today',
    history: ['c5'],
  },
  {
    id: 'u6',
    name: 'Chris Donnelly',
    phone: '+16145550155',
    email: 'cdonnelly@example.com',
    address: '5522 Blacklick Dr, Reynoldsburg',
    propertyType: 'RESIDENTIAL',
    status: 'ACTIVE',
    added: '4 hours ago',
    leadSource: 'Inbound call',
    roofAge: 'Modified bitumen · 18 years',
    since: '30 Jun 2022',
    history: ['c6'],
    appointmentId: 'a4',
  },
];

/* ── Knowledge base ──────────────────────────────────────────────────────── */

export type PreviewArticle = {
  id: string;
  title: string;
  excerpt: string;
  /** `KnowledgeCategory`. */
  category: string;
  /** `KnowledgeStatus`, omitted while the article is published. */
  status?: string;
  updated: string;
  version: number;
};

export const articles: PreviewArticle[] = [
  {
    id: 'k1',
    title: 'What happens on an emergency call after hours?',
    // "roof leak" is here on purpose: it is what the tour types into the
    // knowledge base search, and this is the article the search has to find.
    excerpt:
      'A roof leak, storm damage, or anything letting water into the property is paged straight to the on-call crew, and a tarp visit is held for the next morning.',
    category: 'EMERGENCY',
    updated: '2 days ago',
    version: 4,
  },
  {
    id: 'k2',
    title: 'Workmanship warranty — what is covered, and for how long',
    excerpt:
      'Ten years on workmanship for full replacements, two years on repairs, transferable once to a new homeowner. Manufacturer shingle warranties are registered on your behalf.',
    category: 'WARRANTY',
    updated: '5 days ago',
    version: 7,
  },
  {
    id: 'k3',
    title: 'Insurance claims: what we need from the homeowner',
    excerpt:
      'Claim number, adjuster contact and the date of loss. We supply the inspection report, photographs and a line-item estimate the adjuster can work from.',
    category: 'POLICIES',
    updated: '1 week ago',
    version: 3,
  },
  {
    id: 'k4',
    title: 'Financing options and monthly payment ranges',
    excerpt:
      'Zero-interest for twelve months on approved credit, or fixed monthly terms up to sixty months. Soft credit check only until the job is signed.',
    category: 'FINANCING',
    updated: '1 week ago',
    version: 2,
  },
  {
    id: 'k5',
    title: 'Frequently asked: how long does a roof replacement take?',
    excerpt:
      'Most single-family replacements are one working day, two if the deck needs repairs. Crews arrive at 7:30 AM and the site is cleared and magnet-swept the same evening.',
    category: 'FAQ',
    updated: '2 weeks ago',
    version: 5,
  },
  {
    id: 'k6',
    title: 'Service areas and travel charges',
    excerpt:
      'Franklin County and the ring of suburbs inside I-270 with no travel charge. Delaware and Licking County by arrangement.',
    category: 'SERVICE_AREAS',
    status: 'DRAFT',
    updated: '3 weeks ago',
    version: 1,
  },
];

/* ── Notifications ───────────────────────────────────────────────────────── */

export type PreviewNotification = {
  id: string;
  /** `NotificationType` — selects the row icon. */
  type: string;
  title: string;
  message: string;
  ago: string;
  unread: boolean;
  critical?: boolean;
};

export const notifications: PreviewNotification[] = [
  {
    id: 'n1',
    type: 'EMERGENCY',
    title: 'Emergency call routed',
    message: 'Dana Whitfield — active leak in Dublin. On-call crew paged by SMS and push.',
    ago: '12 minutes ago',
    unread: true,
    critical: true,
  },
  {
    id: 'n2',
    type: 'APPOINTMENT_REQUEST',
    title: 'Appointment confirmed',
    message: 'Marcus Bell — full replacement estimate, Thursday 15 Aug at 10:00 AM.',
    ago: '38 minutes ago',
    unread: true,
  },
  {
    id: 'n3',
    type: 'NEW_LEAD',
    title: 'Lead qualified',
    message: 'Priya Raman — wind damage, inside the service area, ready to schedule.',
    ago: '1 hour ago',
    unread: true,
  },
  {
    id: 'n4',
    type: 'NEW_CALL',
    title: 'AI answered a call',
    message: 'Tom Alvarez asked about gutter replacement across the front elevation.',
    ago: '2 hours ago',
    unread: false,
  },
  {
    id: 'n5',
    type: 'APPOINTMENT_REQUEST',
    title: 'Appointment requested',
    message: 'Renee Okafor — hail claim inspection for her insurer, date to confirm.',
    ago: '3 hours ago',
    unread: false,
  },
  {
    id: 'n6',
    type: 'CALL_SUMMARY',
    title: 'Call summary ready',
    message:
      'Alma Vasquez — warranty terms for a skylight reseal, answered from your knowledge base.',
    ago: '5 hours ago',
    unread: false,
  },
];

/** Unread badge on the sidebar and the header bell. */
export const unreadCount = notifications.filter((item) => item.unread).length;

/* ── The demo's live records ─────────────────────────────────────────────── */

/**
 * The call that arrives while the showcase is running.
 *
 * It is a fixture like the rest, not a random event: the demo's timeline decides
 * when it rings, when the receptionist answers and when it lands in the log, so
 * every visitor sees the same call handled the same way. `outcome` is empty
 * until the conversation ends, because that is when the product knows it.
 */
export const incomingCall = {
  id: 'live',
  name: 'Nora Bishop',
  phone: '+16145550137',
  city: 'Worthington, OH',
  intent: 'EMERGENCY_REPAIR',
  outcome: 'EMERGENCY',
  summary:
    'Water staining spreading across the upstairs ceiling since this morning’s hail. On-call crew paged; emergency tarp held for 8:00 AM tomorrow.',
  at: 'Today, just now',
} as const;

/** The notification that arrives on the Notifications page mid-demo. */
export const incomingNotification: PreviewNotification = {
  id: 'n0',
  type: 'EMERGENCY',
  title: 'Emergency call routed',
  message: 'Nora Bishop — hail damage in Worthington. On-call crew paged by SMS and push.',
  ago: 'Just now',
  unread: true,
  critical: true,
};

/* ── Settings ────────────────────────────────────────────────────────────── */

/** The business profile, as `SettingsPage`'s Business tab reads it back. */
export const businessProfile = [
  ['Company name', 'Summit Roofing'],
  ['Business email', 'office@summitroofing.example'],
  ['Business phone', '(614) 555-0100'],
  ['Website', 'summitroofing.example'],
  ['Address', '2400 Olentangy River Rd'],
  ['City', 'Columbus'],
  ['State', 'OH'],
  ['ZIP', '43210'],
  ['Timezone', 'America/New_York'],
  ['Roofing services', 'Replacement, Repair, Inspection, Gutters'],
  ['Service areas', 'Franklin County, Delaware County'],
  ['Emergency phone', '(614) 555-0111'],
] as const;

/** The AI receptionist configuration, matching the AI tab's fields. */
export const aiConfig = {
  assistantName: 'Riley',
  voice: 'Ember',
  greeting: 'Thanks for calling Summit Roofing, this is Riley. How can I help today?',
  persona: 'Warm, efficient, never pushy',
  instructions: 'Always mention the ten-year workmanship warranty on full replacements.',
  toggles: [
    { label: 'Capture leads', hint: 'Collect caller contact details.', on: true },
    { label: 'Detect emergencies', hint: 'Flag leaks and storm damage.', on: true },
    { label: 'Request appointments', hint: 'Offer to schedule visits.', on: true },
  ],
} as const;

/** The week, as the Hours tab lays it out. */
export const businessHours = [
  { day: 'monday', open: '08:00', close: '18:00', closed: false },
  { day: 'tuesday', open: '08:00', close: '18:00', closed: false },
  { day: 'wednesday', open: '08:00', close: '18:00', closed: false },
  { day: 'thursday', open: '08:00', close: '18:00', closed: false },
  { day: 'friday', open: '08:00', close: '18:00', closed: false },
  { day: 'saturday', open: '09:00', close: '14:00', closed: false },
  { day: 'sunday', open: '00:00', close: '00:00', closed: true },
] as const;

/** Phone setup, as the Phone tab's control centre and number card show it. */
export const phoneSetup = {
  aiNumber: '+16145550188',
  businessNumber: '+16145550100',
  carrier: 'AT&T',
  verified: true,
} as const;
