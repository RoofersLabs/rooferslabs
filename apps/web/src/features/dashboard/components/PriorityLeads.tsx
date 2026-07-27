import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';
import { StatusLabel } from './StatusLabel';

/** Same hues the rest of the dashboard uses for these levels — no new colors. */
const TONES = {
  Emergency: 'danger',
  High: 'brand',
  Medium: 'neutral',
} as const;

/**
 * The mobile dashboard's lead section — the first actionable thing an owner or
 * a field rep sees after the greeting.
 *
 * Mobile only (`lg:hidden`). On a desktop the same information is already two
 * clicks away in Recent calls, and the desktop layout is deliberately unchanged.
 *
 * Each lead is its own card rather than a row in a list: the CTA has to be a
 * full-width target that can be hit while walking, and rows cannot carry one
 * without turning the list into a column of buttons.
 */
export function PriorityLeads({ leads, isLoading }: { leads: PriorityLead[]; isLoading: boolean }) {
  // Nothing to call back yet. The section removes itself rather than showing an
  // empty card above the metrics — "No calls yet" already appears once further
  // down in Recent calls, and saying it twice on one phone screen is noise.
  if (!isLoading && !leads.length) return null;

  return (
    <section aria-label="Priority leads" className="lg:hidden">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-h5 text-ink">Priority leads</h2>
        <Link
          to={ROUTES.calls}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {isLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i}>
              <LeadSkeleton />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li key={lead.id}>
              <LeadCard lead={lead} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadCard({ lead }: { lead: PriorityLead }) {
  return (
    <Card as="article" className="rounded-md p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{lead.name}</h3>
        <StatusLabel tone={TONES[lead.priority]}>{lead.priority}</StatusLabel>
      </div>

      {lead.address && <p className="mt-1 truncate text-small text-ink-muted">{lead.address}</p>}

      {lead.summary && (
        // Three lines is the ceiling: enough to say why they called, short
        // enough to read at a glance without turning the card into a page.
        <p className="mt-3 line-clamp-3 text-small leading-6 text-ink-muted">{lead.summary}</p>
      )}

      {lead.phone ? (
        <a
          href={`tel:${lead.phone}`}
          // `lg` is the 48px control — a one-tap target with gloves on.
          className={buttonClass('primary', 'lg', 'mt-5 w-full')}
        >
          Call Homeowner
        </a>
      ) : (
        // A lead with no number reaches the same layout rather than a shorter
        // card, so a column of leads never jumps as it scrolls.
        <Button variant="primary" size="lg" className="mt-5 w-full" disabled>
          No number captured
        </Button>
      )}
    </Card>
  );
}

function LeadSkeleton() {
  return (
    <Card className="rounded-md p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="mt-2 h-4 w-52" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <Skeleton className="mt-5 h-12 w-full" />
    </Card>
  );
}
