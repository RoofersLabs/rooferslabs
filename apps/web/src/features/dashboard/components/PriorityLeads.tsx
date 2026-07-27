import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { formatPhone } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';
import { StatusLabel } from './StatusLabel';

/**
 * Priority as flat colored text — no fill, no border, no pill.
 *
 * These are `StatusLabel`'s tones, the dashboard's own indicator: `danger`
 * resolves to red, `warning` to orange, `brand` to blue, from the same tokens
 * every other status on this page uses.
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
        <ul className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i}>
              <LeadSkeleton />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-4">
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
 * One lead as a portrait card, stacked for a two-second top-to-bottom read:
 * who called, how to reach them, where the property is, how urgent it is, why
 * they called, and the one action that matters.
 *
 * Gaps widen on the way down — 4px inside the identity block, 16px to the
 * priority, 20px to the summary, 24px to the button — so the eye is handed
 * from section to section instead of meeting one even column of text.
 */
function LeadCard({ lead }: { lead: PriorityLead }) {
  return (
    // Border, surface and shadow are the Card's untouched defaults; only the
    // radius steps to 14px and the padding to 24px. The portrait proportion
    // comes from the stacked content, not from a width constraint — the card
    // already spans ~92% of a phone inside the page gutter, and pulling it
    // narrower would break its alignment with every section below it.
    <Card as="article" className="rounded-lg p-6">
      <h3 className="truncate text-h4 text-ink">{lead.name}</h3>

      {/* Identity block: the number and the address belong to the name above
          them, so they sit tight to it and the next section opens the gap. */}
      {lead.phone && (
        <p className="font-num mt-1 text-small text-ink-muted">{formatPhone(lead.phone)}</p>
      )}

      {lead.address && (
        <p className="mt-1 line-clamp-2 text-small text-ink-muted">{lead.address}</p>
      )}

      {/* `block` because a bare `<span>` is inline, and vertical margin does
          nothing on an inline box — the gap above would silently collapse. */}
      <StatusLabel tone={TONES[lead.priority]} className="mt-4 block">
        {lead.priority}
      </StatusLabel>

      {lead.summary && (
        <div className="mt-5">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            Call summary
          </h4>
          <p className="mt-1.5 line-clamp-3 text-small text-ink-muted">{lead.summary}</p>
        </div>
      )}

      {/* The widest gap on the card, so the action reads as the card's
          conclusion rather than another line of content. `font-medium`
          overrides the button's semibold per spec; the white label is the
          primary variant's own `text-ink-on-brand` (#ffffff in both themes). */}
      <div className="mt-6 flex justify-center">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className={buttonClass('primary', 'lg', 'w-4/5 font-medium')}
          >
            Call Homeowner
          </a>
        ) : (
          // A lead with no number keeps the same footprint, so a scrolling
          // column of cards never jumps.
          <Button variant="primary" size="lg" className="w-4/5 font-medium" disabled>
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
    <Card className="rounded-lg p-6">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-2 h-4 w-52" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-5 h-3 w-24" />
      <Skeleton className="mt-2.5 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <div className="mt-6 flex justify-center">
        <Skeleton className="h-12 w-4/5" />
      </div>
    </Card>
  );
}
