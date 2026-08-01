import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { formatPhone } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PriorityLead } from '../insights';
import { LeadDetailSheet } from './LeadDetailSheet';
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
 * The geometry is what makes every card come to rest dead centre, so it is
 * worth stating exactly. Writing V for the viewport width:
 *
 *   `-mx-4` cancels the shell's 16px page gutter, so the track's border box is
 *   exactly V and a card behind the active one runs off the display rather than
 *   stopping at an invisible margin.
 *
 *   `px-8` then puts 32px back as padding, which leaves a content box of V-64.
 *   A slide is `w-full` of that, so the leftover is 32px — and it is split
 *   evenly either side only because the padding is what created it. That is the
 *   whole trick: the first card is centred at scroll offset 0 and the last at
 *   maximum scroll, with no scripted correction and nothing to settle on load.
 *
 *   Both step at `sm:` because the shell's gutter does, keeping the same
 *   proportions on the larger phones and small tablets this section still
 *   covers (it is hidden from `lg` up).
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
 *   No scroll-padding: the snapport is the full scrollport, so "centred in the
 *   snapport" and "centred on screen" are the same statement. The gutter-sized
 *   scroll-padding this track used to carry existed to align a start-snapped
 *   card to the page gutter, and would now only be a second, redundant
 *   definition of the centre. (Spelling the old utility out here would also be
 *   enough for Tailwind's scanner to keep emitting a rule nothing uses — it
 *   reads comments too.)
 *
 *   `overscroll-x-contain` keeps a swipe past the last card from reaching the
 *   browser's back-navigation gesture, while leaving the rubber-band at the ends
 *   intact — that bounce is the platform telling the reader they have run out of
 *   leads, and removing it reads as a stuck scroller rather than a polished one.
 *
 * The scrollbar is hidden four ways because no single property covers Firefox,
 * legacy Edge and WebKit. `-webkit-overflow-scrolling` buys momentum on older
 * iOS; current Safari does it by default.
 */
const TRACK = [
  '-mx-4 -my-2 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-8 py-2',
  'sm:-mx-6 sm:px-10',
  '[-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  // The track is focusable, so it must show a ring — drawn inside its own box
  // because the box now reaches the screen edge, where an outset ring would be
  // clipped by the viewport.
  'focus-visible:[outline-offset:-2px]',
].join(' ');

/**
 * One slide.
 *
 * `w-full` is the track's content box, which the padding above has already
 * sized to leave 32px of viewport either side of a centred card — wide enough
 * to be the page's subject, inset enough not to run to the edges. With a 12px
 * gap that leaves 20px of the neighbouring card showing, which is the only cue
 * needed that a swipe is available and cheaper than a row of dots.
 *
 * `snap-center` rather than `snap-start`: there is one card to read at a time,
 * so its resting place is the middle of the screen. Every slide takes the same
 * alignment — the first and last included, because the track's padding gives
 * them the scroll room to reach it, which is what a `last:snap-end` exception
 * used to be compensating for.
 *
 * `snap-always` forbids skipping a snap point, so a hard flick advances exactly
 * one card instead of throwing three past the eye.
 */
const SLIDE = 'w-full shrink-0 snap-center snap-always';

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

  // One sheet for the deck, not one per card: the panel is a single surface
  // whichever lead opened it, and mounting five of them into the same portal
  // would be four dialogs' worth of listeners and focus traps for nothing.
  //
  // `lead` deliberately survives `open` going false. Radix keeps the panel
  // mounted while its exit animation runs, so clearing the lead on close would
  // blank the content for the length of the dismissal — the sheet would slide
  // away empty. The stale lead is invisible and replaced on the next open.
  const [detailLead, setDetailLead] = useState<PriorityLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const view = useCallback((next: PriorityLead) => {
    setDetailLead(next);
    setDetailOpen(true);
  }, []);

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
            <LeadCard lead={lead} position={i + 1} total={leads.length} onView={() => view(lead)} />
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

      {/* Rendered once, outside the track. It portals to the body regardless, so
          its position in the tree costs nothing — but keeping it out of the
          scroll container keeps the overflow rules above about cards only. */}
      <LeadDetailSheet lead={detailLead} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

/**
 * One lead as a portrait card, stacked for a two-second top-to-bottom read:
 * who called, how to reach them, where the property is, how urgent it is, why
 * they called, and the one action that matters.
 *
 * Gaps widen on the way down — 8px inside the identity block, 20px to the
 * priority, 24px to the summary, 32px to the button — so the eye is handed
 * from section to section instead of meeting one even column of text.
 *
 * Those figures, and the 28/32px gutters below, are what make the card tall.
 * The height is a consequence of the content being given room to separate,
 * never of a minimum: a card padded out to a fixed height would print its
 * slack as a blank band above the button on every lead with a short summary,
 * which is the compressed-then-empty look this spacing exists to avoid.
 */
function LeadCard({
  lead,
  position,
  total,
  onView,
}: {
  lead: PriorityLead;
  position: number;
  total: number;
  /** Opens the detail sheet for this lead. */
  onView: () => void;
}) {
  return (
    // Border, surface and shadow are the Card's untouched defaults; only the
    // radius steps to 14px and the gutters to 28px across and 32px down. The
    // extra height goes on the vertical axis because that is the axis the card
    // was short on — 28px across keeps the text measure comfortable on a 360px
    // phone, where 32px would start to narrow the summary. The portrait
    // proportion comes from the stacked content, not from a width constraint:
    // the slide sets the width, and the card fills it.
    //
    // `h-full` is the one addition the carousel asks for: slides are flex items
    // and stretch to the tallest, so without it a lead with no summary would
    // leave a short card floating in a tall row. Filling instead means the
    // section's height is fixed and swiping never resizes the page underneath.
    <Card as="article" className="h-full rounded-lg px-7 py-8">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate text-h4 text-ink">{lead.name}</h3>
        {/* Position, not progress dots: "4 of 18" says how much work is left,
            which is the thing a crew actually wants to know. */}
        <span className="font-num shrink-0 pt-1 text-caption text-ink-faint">
          Lead {position} of {total}
        </span>
      </div>

      {/* Identity block: the number and the address belong to the name above
          them, so they sit tighter to it than any section gap on the card —
          close enough to read as one unit, far enough not to crowd the name. */}
      {lead.phone && (
        <p className="font-num mt-2 text-small text-ink-muted">{formatPhone(lead.phone)}</p>
      )}

      {lead.address && (
        <p className="mt-1.5 line-clamp-2 text-small text-ink-muted">{lead.address}</p>
      )}

      {/* `block` because a bare `<span>` is inline, and vertical margin does
          nothing on an inline box — the gap above would silently collapse. */}
      <StatusLabel tone={TONES[lead.priority]} className="mt-5 block">
        {lead.priority}
      </StatusLabel>

      {lead.summary && (
        <div className="mt-6">
          <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            Call summary
          </h4>
          <p className="mt-2 line-clamp-3 text-small text-ink-muted">{lead.summary}</p>
        </div>
      )}

      {/* The widest gap on the card, so the action reads as the card's
          conclusion rather than another line of content. Nothing here restyles
          the button: weight, radius and the white label all come from the
          primary variant, which is the only place they should come from.
          `mt-auto pt-8` rather than `mt-8`: 32px is still the minimum gap, but
          on a slide taller than its content — a lead with no summary beside one
          with three lines of it — the slack collects above the button instead
          of below it, so the action stays the card's last line and the call
          buttons line up as you swipe.

          The two actions share the row rather than stacking: stacking costs
          another 60px of height on every card and pushes the call further from
          the thumb. Both keep the `lg` height, so both stay 48px tall and well
          past the 44px minimum target — the row is tight across, never down.

          Across is where it has to be earned, and this is the tightest row in
          the product. The card's interior is the viewport less 120px (64 of
          track padding, 56 of card gutter), so a 360px phone leaves 240px for
          two buttons and a gap — and `lg`'s pill padding of 24px a side does
          not fit "Call Homeowner" and "View" inside that.

          Both therefore run at `px-4`. That is under the h/2 the pill shape
          wants, so it is a deliberate exception rather than a second opinion
          about the design system: the alternative is `md`, which fits easily
          but drops both targets to 40px, and a 48px target on the dashboard's
          primary action is worth more than 8px of optical padding on the one
          card where the two compete. `min-w-0` with a truncating label is the
          floor under it — on the narrowest phones the label ellipsises rather
          than pushing the row through the side of the card. */}
      <div className="mt-auto flex items-center gap-3 pt-8">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            className={buttonClass('primary', 'lg', 'min-w-0 flex-1 px-4')}
          >
            <span className="truncate">Call Homeowner</span>
          </a>
        ) : (
          // A lead with no number keeps the same footprint, so a scrolling
          // column of cards never jumps. The label is shorter than the sentence
          // it used to be because it now shares the row — the sheet behind View
          // gives the full explanation.
          <Button variant="primary" size="lg" className="min-w-0 flex-1 px-4" disabled>
            <span className="truncate">No number</span>
          </Button>
        )}

        {/* Always enabled, including on the lead above with no number: a lead
            nobody can ring is exactly the one worth reading before deciding
            what to do with it. `secondary` is the design system's quieter
            button — bordered, unfilled — so it reads as the lesser of the two
            without a bespoke style. */}
        <Button variant="secondary" size="lg" className="shrink-0 px-4" onClick={onView}>
          View
        </Button>
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
    // Every metric here is `LeadCard`'s, down to the gutters: this is the shape
    // the section holds while the request is in flight, so any figure that
    // drifts from the real card is a jump at the moment the leads arrive.
    <Card className="rounded-lg px-7 py-8">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-1.5 h-4 w-52" />
      <Skeleton className="mt-5 h-3 w-20" />
      <Skeleton className="mt-6 h-3 w-24" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      {/* Two placeholders, matching the two actions the loaded card draws — a
          single wide one would resolve into a narrower pair and shift the row. */}
      <div className="mt-auto flex items-center gap-3 pt-8">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 w-[68px] shrink-0 rounded-full" />
      </div>
    </Card>
  );
}
