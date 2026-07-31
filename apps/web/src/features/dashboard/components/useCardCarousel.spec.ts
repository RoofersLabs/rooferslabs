import { centerDelta } from './useCardCarousel';

/**
 * The priority-leads carousel's real geometry on a 390px phone, which is what
 * the track's padding is chosen to produce:
 *
 *   track border box  390   (full bleed — the shell's gutter is cancelled)
 *   padding            32   each side
 *   slide             326   the content box, so 32px of viewport shows either side
 *   gap                12
 *
 * The numbers matter because the whole centring guarantee is geometric: if a
 * slide's resting place is anything but the middle, it is these figures that
 * stopped agreeing.
 */
const VIEW = 390;
const PAD = 32;
const SLIDE = VIEW - PAD * 2;
const GAP = 12;

/** The rect of slide `i` when the track has not been scrolled. */
const slideAt = (i: number) => ({ left: PAD + i * (SLIDE + GAP), width: SLIDE });
const track = (left = 0) => ({ left, width: VIEW });

describe('centerDelta', () => {
  it('leaves the first card alone — it is already centred at rest', () => {
    // The load-time promise: no scripted correction, so nothing shifts under
    // the reader between first paint and the carousel becoming interactive.
    expect(centerDelta(track(), slideAt(0))).toBe(0);
  });

  it('advances by exactly one card pitch', () => {
    // Slide plus gap. Anything else lands off-centre and mandatory snapping
    // then drags the card the rest of the way, which is the visible jitter
    // this replaced.
    expect(centerDelta(track(), slideAt(1))).toBe(SLIDE + GAP);
    expect(centerDelta(track(), slideAt(2))).toBe(2 * (SLIDE + GAP));
  });

  it('is symmetric, so going back undoes going forward', () => {
    const forward = centerDelta(track(), slideAt(1));

    // Once card 1 is centred the track has scrolled by `forward`, which drags
    // every slide's viewport-relative left edge back by the same amount.
    const afterScroll = (i: number) => ({ ...slideAt(i), left: slideAt(i).left - forward });

    expect(centerDelta(track(), afterScroll(1))).toBe(0);
    expect(centerDelta(track(), afterScroll(0))).toBe(-forward);
  });

  it('measures relative position, so the page offset cannot skew it', () => {
    // Rects are viewport-relative and the track moves: a rubber-band at the end
    // of the deck, a sticky header resizing, an inspector docked to the side.
    // Only the distance between the two centres may matter.
    const shifted = 137;
    expect(centerDelta(track(shifted), { ...slideAt(1), left: slideAt(1).left + shifted })).toBe(
      SLIDE + GAP,
    );
  });

  it('centres the last card exactly at the end of the scroll range', () => {
    // The load-bearing assertion. For a three-card deck the scrollable distance
    // is the content width less the viewport:
    //
    //   32 + 3·326 + 2·12 + 32 − 390 = 676
    //
    // and the distance that centres the third card is two pitches: 2·338 = 676.
    // They are the same number, which is the proof that the trailing padding is
    // sized correctly — the last card reaches dead centre exactly as the
    // scroller runs out, with nothing left over to rest short on. This is the
    // position start-alignment could not reach, and the reason the old slide
    // carried a `last:` exception.
    const maxScroll = PAD + 3 * SLIDE + 2 * GAP + PAD - VIEW;

    expect(centerDelta(track(), slideAt(2))).toBe(maxScroll);
    expect(maxScroll).toBe(676);
  });

  it('holds at the sm gutter, where the padding steps to 40px', () => {
    // The same statement one breakpoint up: the pitch changes, the centring does
    // not, because nothing here hard-codes a card width.
    const smView = 640;
    const smPad = 40;
    const smSlide = smView - smPad * 2;
    expect(centerDelta({ left: 0, width: smView }, { left: smPad, width: smSlide })).toBe(0);
    expect(
      centerDelta({ left: 0, width: smView }, { left: smPad + smSlide + GAP, width: smSlide }),
    ).toBe(smSlide + GAP);
  });
});
