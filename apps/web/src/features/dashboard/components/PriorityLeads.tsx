import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';

/**
 * Priority as a tinted badge rather than colored text.
 *
 * These are `Badge`'s own tones, so the fill, border and text hue all come from
 * the same tokens the rest of the product labels statuses with: `danger` is the
 * soft red, `warning` the soft orange, `brand` the soft blue. Nothing new is
 * introduced — the levels are simply mapped onto tones that already exist.
 */
const TONES = {
  Emergency: 'danger',
  High: 'warning',
  Medium: 'brand',
} as const;

/**
 * The mobile dashboard's lead section — the first actionable thing an owner or
 * a field rep sees after the greeting.
 *
 * Mobile only (`lg:hidden`). On a desktop the same information is already two
 * clicks away in Recent calls, and the desktop layout is deliberately unchanged.
 *
 * Each lead is its own card rather than a row in a list: every lead carries its
 * own call action, and a row cannot hold one without turning the list into a
 * column of buttons.
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

/**
 * One lead, ordered for a two-second read: name, priority, address, why they
 * called, then the way to act on it.
 *
 * `items-center` on the top row is what puts the badge on the name's optical
 * centre — the badge is 20px against a 29px line box, so aligning to the top
 * would leave it visibly high.
 */
function LeadCard({ lead }: { lead: PriorityLead }) {
  return (
    <Card as="article" className="rounded-md p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-body-lg font-semibold text-ink">{lead.name}</h3>
        <Badge tone={TONES[lead.priority]}>{lead.priority}</Badge>
      </div>

      {lead.address && <p className="mt-0.5 truncate text-small text-ink-muted">{lead.address}</p>}

      {lead.summary && (
        // Three lines, at the body's own leading rather than a looser one: the
        // summary has to explain the call without out-weighing the name above
        // it or pushing the button off the first screen.
        <p className="mt-2 line-clamp-3 text-small text-ink-muted">{lead.summary}</p>
      )}

      {/* The CTA is inset rather than full-bleed. At 80% it still reads as the
          card's primary action and stays an easy thumb target, without the
          edge-to-edge bar that made the button the loudest thing on screen. */}
      <div className="mt-4 flex justify-center">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className={buttonClass('primary', 'md', 'w-4/5')}>
            Call Homeowner
          </a>
        ) : (
          // A lead with no number keeps the same footprint, so a scrolling
          // column of cards never jumps.
          <Button variant="primary" size="md" className="w-4/5" disabled>
            No number captured
          </Button>
        )}
      </div>
    </Card>
  );
}

/** Mirrors `LeadCard`'s metrics so the list does not resize when data lands. */
function LeadSkeleton() {
  return (
    <Card className="rounded-md p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-1.5 h-4 w-52" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-10 w-4/5" />
      </div>
    </Card>
  );
}
