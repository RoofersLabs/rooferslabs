import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Clock, Timer, Flame } from 'lucide-react';
import { ConversationOutcome, LeadQuality, UrgencyLevel } from '@rooferslabs/shared';
import type { Conversation, DashboardOverview } from '@/types/api';
import { formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';

/**
 * Everything below is derived on the client from data the dashboard already
 * fetches — no new API calls. Values describe exactly what they measure (e.g.
 * "recent calls") so nothing is presented as an all-time guarantee.
 */

export interface SummaryTile {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

/** Outcomes that count as the AI having handled the caller's need. */
const RESOLVED_OUTCOMES = new Set(['APPOINTMENT_REQUESTED', 'INFORMATION_PROVIDED', 'EMERGENCY']);

export function deriveReceptionistSummary(
  conversations: Conversation[],
  metrics: DashboardOverview['metrics'] | undefined,
): SummaryTile[] {
  const total = conversations.length;
  const resolved = conversations.filter(
    (c) => c.outcome && RESOLVED_OUTCOMES.has(c.outcome),
  ).length;
  const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

  const durations = conversations
    .map((c) => c.call?.durationSeconds)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const avgSeconds = durations.length
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
    : 0;

  const weeklyCalls = metrics?.weeklyCalls ?? 0;
  // Time the AI handled instead of staff, estimated from real weekly volume and
  // the average handle time above (falls back to a conservative 4 minutes/call).
  const perCall = avgSeconds || 240;
  const hoursSaved = (weeklyCalls * perCall) / 3600;

  return [
    {
      icon: CheckCircle2,
      label: 'Resolution rate',
      value: total ? `${resolutionRate}%` : '—',
      hint: total ? `${resolved} of ${total} recent calls` : 'No recent calls',
    },
    {
      icon: Clock,
      label: 'Avg. call length',
      value: avgSeconds ? formatDuration(avgSeconds) : '—',
      hint: durations.length ? `Across ${durations.length} recent calls` : 'No recent calls',
    },
    {
      icon: Timer,
      label: 'Hours saved',
      value: weeklyCalls ? `${hoursSaved.toFixed(1)}h` : '—',
      hint: weeklyCalls ? `≈ ${weeklyCalls} calls this week` : 'This week',
    },
    {
      icon: Flame,
      label: 'Leads today',
      value: `${metrics?.todaysLeads ?? 0}`,
      hint: 'Captured by your AI',
    },
  ];
}

/**
 * The three levels a lead card can carry. Deliberately fewer than the four
 * `UrgencyLevel` values the API reports: on a phone, in the sun, between jobs,
 * "is this on fire, does it need me today, or can it wait" is the only
 * distinction that changes what the owner does next. LOW and MEDIUM urgency
 * both mean "can wait", so they collapse.
 */
export type LeadPriority = 'Emergency' | 'High' | 'Medium';

export interface PriorityLead {
  /** The conversation id — the card links to the full transcript. */
  id: string;
  name: string;
  /** Null when the caller never gave an address; the card omits the line. */
  address: string | null;
  priority: LeadPriority;
  summary: string | null;
  /** E.164, straight from the record — `tel:` wants the raw digits, not a display format. */
  phone: string | null;
  /**
   * The conversation this lead was projected from, carried through for the
   * detail sheet.
   *
   * A reference rather than a dozen more flattened fields: the sheet shows what
   * the conversation page shows — outcome, intent, lead quality, urgency, key
   * points, the appointment request, call time and duration — and copying each
   * one into this view model would only create a second list to keep in step
   * with the first. The dashboard has already fetched every conversation, so
   * this costs nothing and adds no request.
   *
   * The fields above stay as they are: they are what the *card* renders, and a
   * card should not be reaching into an API type to draw a name.
   */
  source: Conversation;
}

/** Outcomes that mean the AI captured something worth calling back. */
const LEAD_OUTCOMES = new Set<string>([
  ConversationOutcome.LEAD_CAPTURED,
  ConversationOutcome.APPOINTMENT_REQUESTED,
  ConversationOutcome.EMERGENCY,
]);

/** Ranked so the sort is a subtraction rather than a chain of comparisons. */
const PRIORITY_RANK: Record<LeadPriority, number> = { Emergency: 3, High: 2, Medium: 1 };

function priorityOf(conversation: Conversation): LeadPriority {
  if (conversation.isEmergency || conversation.urgency === UrgencyLevel.EMERGENCY) {
    return 'Emergency';
  }
  if (conversation.urgency === UrgencyLevel.HIGH || conversation.leadQuality === LeadQuality.HOT) {
    return 'High';
  }
  return 'Medium';
}

/**
 * Whether a conversation is a lead the owner should call back.
 *
 * Spam is excluded outright — it is the one outcome where showing the card at
 * the top of the phone would be actively wrong. Everything else qualifies by
 * the AI's own read of the call: an emergency, a lead-shaped outcome, or a
 * quality tier it rated worth keeping.
 */
function isCapturedLead(conversation: Conversation): boolean {
  if (conversation.outcome === ConversationOutcome.SPAM) return false;
  return (
    conversation.isEmergency ||
    (conversation.outcome !== null && LEAD_OUTCOMES.has(conversation.outcome)) ||
    conversation.leadQuality === LeadQuality.HOT ||
    conversation.leadQuality === LeadQuality.WARM
  );
}

/**
 * The newest captured leads, most urgent first — the mobile dashboard's lead
 * section.
 *
 * Derived from the conversations the dashboard already fetches, so the phone
 * makes no extra request on a job site. Ordering is priority first and recency
 * second: a two-hour-old emergency outranks a lead captured five minutes ago,
 * because one of them is water coming through a ceiling.
 */
export function derivePriorityLeads(conversations: Conversation[], limit = 5): PriorityLead[] {
  // `filter` already copied the array, so sorting here cannot reorder the
  // caller's list. Recency is compared explicitly rather than leaning on the
  // API's ordering surviving a stable sort.
  return conversations
    .filter(isCapturedLead)
    .sort((a, b) => {
      const byPriority = PRIORITY_RANK[priorityOf(b)] - PRIORITY_RANK[priorityOf(a)];
      return byPriority !== 0 ? byPriority : Date.parse(b.createdAt) - Date.parse(a.createdAt);
    })
    .slice(0, limit)
    .map((conversation) => ({
      id: conversation.id,
      name: conversation.customer?.fullName?.trim() || formatPhone(conversation.call?.fromNumber),
      address: conversation.customer?.propertyAddress?.trim() || null,
      priority: priorityOf(conversation),
      summary: conversation.summary?.trim() || null,
      phone: conversation.customer?.phone ?? conversation.call?.fromNumber ?? null,
      source: conversation,
    }));
}

export interface InsightRow {
  label: string;
  count: number;
  percent: number;
}

/**
 * Ranked breakdown of what recent callers wanted, by detected intent.
 * Percentages are shares of the recent conversations that had an intent.
 */
export function deriveTopInsights(conversations: Conversation[], limit = 5): InsightRow[] {
  const counts = new Map<string, number>();
  for (const c of conversations) {
    if (!c.intent) continue;
    counts.set(c.intent, (counts.get(c.intent) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (!total) return [];

  return [...counts.entries()]
    .map(([intent, count]) => ({
      label: humanizeEnum(intent),
      count,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
