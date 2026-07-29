import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { formatPhone } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';
import { StatusLabel } from './StatusLabel';
import { useCardCarousel } from './useCardCarousel';

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

      {isLoading ? <LeadSkeleton /> : <LeadCarousel leads={leads} />}
    </section>
  );
}

/**
 * The scroll track: one row of cards the browser scrolls and snaps itself.
 *
 * Reading it outwards —
 *
 *   `-mx-4 px-4` bleeds the track through the page gutter to the screen edge
 *   and puts the gutter back as padding, so a snapped card lines up with every
 *   section above and below it while the card behind it runs off the display
 *   rather than stopping at an invisible margin. `scroll-px-4` makes that same
 *   gutter the snap reference, so "aligned" means aligned to the page, not to
 *   the track's border. Both step at `sm:` because the shell's gutter does.
 *
 *   `-my-2 py-2` is headroom, not spacing: `overflow-y-hidden` clips at the
 *   padding box, and without 8px of it the cards' `shadow-card` would be shaved
 *   off along the top and bottom edges. The negative margin returns the section
 *   to the exact height it had before.
 *
 *   `snap-x snap-mandatory` with `overflow-y-hidden` means the track scrolls on
 *   one axis only and always comes to rest on a card — never between two. The
 *   page still scrolls vertically through the carousel, because no `touch-action`
 *   is set: the browser locks the gesture to an axis on its own, and taking that
 *   over would trap a downward flick that happened to start on a card.
 *
 *   `overscroll-x-contain` keeps a swipe past the last card from reaching the
 *   browser's back-navigation gesture.
 *
 * The scrollbar is hidden four ways because no single property covers Firefox,
 * legacy Edge and WebKit. `-webkit-overflow-scrolling` buys momentum on older
 * iOS; current Safari does it by default.
 */
const TRACK = [
  '-mx-4 -my-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-4 px-4 py-2',
  'sm:-mx-6 sm:scroll-px-6 sm:px-6',
  '[-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  // The track is focusable, so it must show a ring — drawn inside its own box
  // because the box now reaches the screen edge, where an outset ring would be
  // clipped by the viewport.
  'focus-visible:[outline-offset:-2px]',
].join(' ');

/**
 * One slide.
 *
 * `calc(100% - 2.5rem)` is the card at nearly the full width it had as a static
 * block, minus just enough for the next card's edge to show past the gutter —
 * the only cue that a swipe is available, and cheaper than a row of dots.
 *
 * `snap-always` forbids skipping a snap point, so a hard flick advances exactly
 * one card instead of throwing three past the eye. `last:snap-end` gives the
 * final card a snap position it can actually reach: aligned to the start it
 * would need 2.5rem of scroll room that does not exist, so it would come to
 * rest fractionally off — the one place this layout could show a partial card.
 */
const SLIDE = 'w-[calc(100%-2.5rem)] shrink-0 snap-start snap-always last:snap-end';

/**
 * The leads as a horizontal carousel: one card at a time, swiped through.
 *
 * A phone reads one card and moves on; a vertical list of tall cards buries the
 * second lead below the fold and asks the reader to scroll the page to reach
 * it. Sideways, the deck is a single gesture wide and the sections below stay
 * exactly where they were.
 *
 * Everything about the gesture — touch tracking, momentum, rubber-banding, the
 * snap — is the browser's native scroller, running off the main thread. The
 * hook alongside it only reads which card is showing and moves the scroller for
 * the buttons and the arrow keys.
 */
function LeadCarousel({ leads }: { leads: PriorityLead[] }) {
  const track = useRef<HTMLDivElement>(null);
  const carousel = useCardCarousel(track, leads.length);

  return (
    <div>
      {/* The APG carousel pattern: the track is a labelled group announced as a
          carousel, each card a slide inside it. `tabIndex` because a scrollable
          region must be reachable by keyboard in its own right — tabbing to a
          card's call button scrolls that card into view, but a lead with no
          number contributes no focusable element to stop at. */}
      <div
        ref={track}
        {...carousel.handlers}
        role="group"
        aria-roledescription="carousel"
        aria-label="Priority leads"
        tabIndex={0}
        className={TRACK}
      >
        {leads.map((lead, i) => (
          <div
            key={lead.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`Lead ${i + 1} of ${leads.length}`}
            className={SLIDE}
          >
            <LeadCard lead={lead} position={i + 1} total={leads.length} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        {/* Announced politely so the position is available without sight of the
            counter printed on the card. */}
        <p aria-live="polite" className="text-caption text-ink-faint">
          {carousel.canGoNext
            ? `${leads.length - carousel.index - 1} more to review`
            : 'You’re all caught up.'}
        </p>

        {/* Gestures are not the only way through the deck. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={carousel.previous}
            disabled={!carousel.canGoPrevious}
            aria-label="Previous lead"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={carousel.next}
            disabled={!carousel.canGoNext}
            aria-label="Next lead"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
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
    // comes from the stacked content, not from a width constraint — the slide
    // sets the width, and the card fills it.
    //
    // `h-full` is the one addition the carousel asks for: slides are flex items
    // and stretch to the tallest, so without it a lead with no summary would
    // leave a short card floating in a tall row. Filling instead means the
    // section's height is fixed and swiping never resizes the page underneath.
    <Card as="article" className="h-full rounded-lg p-6">
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
          primary variant, which is the only place they should come from.
          `mt-auto pt-6` rather than `mt-6`: 24px is still the minimum gap, but
          on a slide taller than its content — a lead with no summary beside one
          with three lines of it — the slack collects above the button instead
          of below it, so the action stays the card's last line and the call
          buttons line up as you swipe. */}
      <div className="mt-auto flex justify-center pt-6">
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

/**
 * Mirrors `LeadCard`'s metrics so the section does not resize when data lands —
 * including the slide's width, which is why the placeholder sits in the same
 * track rather than spanning the page. It is not scrollable and holds one card:
 * there is nothing yet to swipe between.
 */
function LeadSkeleton() {
  return (
    <div className={TRACK}>
      <div className={SLIDE}>
        <LeadSkeletonCard />
      </div>
    </div>
  );
}

function LeadSkeletonCard() {
  return (
    <Card className="rounded-lg p-6">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-2 h-4 w-52" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="mt-5 h-3 w-24" />
      <Skeleton className="mt-2.5 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <div className="mt-auto flex justify-center pt-6">
        <Skeleton className="h-12 w-4/5" />
      </div>
    </Card>
  );
}
