import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Clock, Timer, Flame } from 'lucide-react';
import type { Conversation, DashboardOverview } from '@/types/api';
import { formatDuration, humanizeEnum } from '@/lib/utils';

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
