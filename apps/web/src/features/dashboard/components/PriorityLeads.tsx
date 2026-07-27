import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { cn, formatPhone } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';
import { StatusLabel } from './StatusLabel';
import { useCardDeck } from './useCardDeck';

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

      {isLoading ? <LeadSkeleton /> : <LeadDeck leads={leads} />}
    </section>
  );
}

/** Depth of the two shells behind the active card: offset down, scaled in. */
const BEHIND = [
  { translate: 10, scale: 0.97 },
  { translate: 20, scale: 0.94 },
] as const;

/**
 * The leads as a deck rather than a feed.
 *
 * One card is readable at a time and the rest sit behind it as edges, so the
 * section is a pile of jobs to work through rather than a column to scroll. A
 * roofer reads the top lead, calls if it warrants it, and flicks it away.
 *
 * Only three cards exist in the DOM at any moment, and the two behind are empty
 * shells: they carry no content because their whole job is to say "there are
 * more". That also makes it impossible to read two leads at once, and keeps the
 * cost of a 200-lead deck identical to a 3-lead one.
 */
function LeadDeck({ leads }: { leads: PriorityLead[] }) {
  const deck = useCardDeck(leads.length);
  const lead = leads[deck.index];
  if (!lead) return null;

  const behind = Math.min(BEHIND.length, leads.length - deck.index - 1);
  // While leaving, the card carries itself a full height off-screen; while
  // dragging it tracks the finger exactly.
  const y = deck.leaving ? deck.leaving * 120 : deck.offset;

  return (
    <div>
      <div
        className="relative"
        role="group"
        aria-roledescription="Lead deck"
        aria-label={`Lead ${deck.index + 1} of ${leads.length}`}
        tabIndex={0}
        onKeyDown={deck.handlers.onKeyDown}
      >
        {/* Shells first so they paint underneath. `aria-hidden`: they are edges,
            not content, and a screen reader announcing two blank cards would be
            noise. */}
        {BEHIND.slice(0, behind).map((depth, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-full transition-transform duration-base ease-standard motion-reduce:transition-none"
            style={{ transform: `translateY(${depth.translate}px) scale(${depth.scale})` }}
          >
            <div className="h-full rounded-lg border border-line-subtle bg-surface shadow-card" />
          </div>
        ))}

        <div
          {...deck.handlers}
          className={cn(
            'relative touch-pan-x select-none',
            // No transition while the finger is down: the card must track it
            // exactly, and easing a live drag reads as lag.
            !deck.dragging && 'transition-transform duration-base ease-standard',
            deck.leaving && 'opacity-0 transition-[transform,opacity] duration-base ease-standard',
            'motion-reduce:transition-none',
          )}
          style={{ transform: `translateY(${y}px)` }}
        >
          <LeadCard lead={lead} position={deck.index + 1} total={leads.length} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {/* Announced politely so the position is available without sight of the
            counter printed on the card. */}
        <p aria-live="polite" className="text-caption text-ink-faint">
          {deck.canGoNext
            ? `${leads.length - deck.index - 1} more to review`
            : 'You’re all caught up.'}
        </p>

        {/* Gestures are not the only way through the deck. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={deck.previous}
            disabled={!deck.canGoPrevious}
            aria-label="Previous lead"
          >
            <ChevronUp className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={deck.next}
            disabled={!deck.canGoNext}
            aria-label="Next lead"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
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
function LeadCard({
  lead,
  position,
  total,
}: {
  lead: PriorityLead;
  position: number;
  total: number;
}) {
  return (
    // Border, surface and shadow are the Card's untouched defaults; only the
    // radius steps to 14px and the padding to 24px. The portrait proportion
    // comes from the stacked content, not from a width constraint — the card
    // already spans ~92% of a phone inside the page gutter, and pulling it
    // narrower would break its alignment with every section below it.
    <Card as="article" className="rounded-lg p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-h4 text-ink">{lead.name}</h3>
        {/* Position, not progress dots: "4 of 18" says how much work is left,
            which is the thing a crew actually wants to know. */}
        <span className="font-num shrink-0 pt-1 text-caption text-ink-faint">
          Lead {position} of {total}
        </span>
      </div>

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
          conclusion rather than another line of content. Nothing here restyles
          the button: weight, radius and the white label all come from the
          primary variant, which is the only place they should come from. */}
      <div className="mt-6 flex justify-center">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className={buttonClass('primary', 'lg', 'w-4/5')}>
            Call Homeowner
          </a>
        ) : (
          // A lead with no number keeps the same footprint, so a scrolling
          // column of cards never jumps.
          <Button variant="primary" size="lg" className="w-4/5" disabled>
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
