import { Suspense, lazy } from 'react';
import { Cta, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { useReducedMotion, useScrollOffset } from '../lib/hooks';

/**
 * The dashboard is the only thing on this page that needs framer-motion, so it
 * is the only thing that pays for it. Lazy-loading it keeps ~35kB of animation
 * runtime off the critical path, and the frame below reserves its exact height
 * so the deferred paint costs nothing in layout shift.
 */
const HeroDashboard = lazy(() => import('../product/HeroDashboard'));

/** Small triangle for the secondary CTA. Drawn, not imported. */
function PlayGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      width={10}
      height={10}
      aria-hidden="true"
      className="text-ink-tertiary"
    >
      <path
        d="M3.5 2.4v7.2a.4.4 0 0 0 .6.35l5.6-3.6a.4.4 0 0 0 0-.7L4.1 2.05a.4.4 0 0 0-.6.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The first viewport.
 *
 * A single centred column — navigation, headline, one sentence, two buttons —
 * and then the product itself, deliberately taller than the space left for it.
 * The fold cropping the console is the point: it says there is more system here
 * than fits on one screen, and it earns the first scroll without a "scroll
 * down" prompt.
 *
 * Hero motion is CSS, not framer-motion. This is the first paint of the site;
 * CSS transitions run off the main thread and are already resolving while
 * React is still mounting everything below.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const reduced = useReducedMotion();
  const offset = useScrollOffset();

  // The console lifts very slightly against the page as you begin to scroll.
  // Capped hard: past about 40px it stops reading as depth and starts reading
  // as a bug.
  const parallax = reduced ? 0 : Math.min(offset * 0.06, 40);

  return (
    <section className="relative isolate overflow-hidden pt-[72px]">
      {/* Background. A hairline grid and one soft pool of light, both masked so
          they never reach an edge — the moment you can see where a background
          treatment stops, it stops being atmosphere and becomes a rectangle. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.032) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.032) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(115% 70% at 50% 0%, #000 15%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(115% 70% at 50% 0%, #000 15%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-[560px]"
          style={{
            background:
              'radial-gradient(58% 100% at 50% 0%, rgba(255,255,255,0.055), transparent 72%)',
          }}
        />
        {/* One accent hairline at the very top edge, fading out both ways. The
            single place the brand colour touches the background. */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(37,99,235,0.5) 35%, rgba(37,99,235,0.5) 65%, transparent)',
          }}
        />
      </div>

      <Shell className="relative pt-14 md:pt-16 lg:pt-20">
        {/* The column is sized for the headline, not the prose — the paragraph
            re-narrows itself to a readable measure below. */}
        <div className="mx-auto max-w-[62.5rem] text-left">
          <Reveal variant="fade">
            <a
              href="#showcase"
              className="pressable inline-flex items-center gap-2 rounded-full border border-subtle bg-white/[0.025] py-1 pl-2.5 pr-3 text-xs text-ink-secondary transition-colors duration-150 ease-out hover:border-strong hover:text-ink"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              Now answering calls 24/7
              <span aria-hidden="true" className="text-ink-quaternary">
                →
              </span>
            </a>
          </Reveal>

          {/* Line breaks are hard-coded. At display size a reflow that orphans
              one word ruins the whole block, and `text-wrap: balance` cannot be
              trusted to break in the same place the copy was written for. Each
              line enters on its own beat — the stagger is what makes a static
              sentence feel authored. */}
          {/* Wider than the column around it. The prose below wants a 34rem
              measure; the headline at 84px needs ~940px to hold "The AI
              operating system" on one line, and letting it inherit the text
              column's width is what breaks it onto three. */}
          {/* `text-balance` complements the authored breaks rather than
              replacing them: the two spans still break where the copy was
              written to break, and balance only governs how each line rewraps
              when a narrow viewport forces it to. */}
          {/* Display type needs its tracking restored explicitly: an arbitrary
              clamp() size carries no letter-spacing, and 80px type at default
              tracking reads loose and unfinished. */}
          <h1 className="mt-7 text-balance text-[clamp(3.5rem,7vw,5rem)] font-semibold leading-[1.04] tracking-[-0.04em]">
            <Reveal variant="blur" as="span" className="block">
              The AI operating system
            </Reveal>
            <Reveal variant="blur" as="span" className="block text-ink-tertiary" index={1}>
              for roofing companies.
            </Reveal>
          </h1>

          <Reveal variant="up" index={3}>
            <p className="mt-7 max-w-xl text-lead text-ink-secondary">
              Answers every call, qualifies the homeowner, books the job, and syncs it to your CRM —
              around the clock.
            </p>
          </Reveal>

          <Reveal variant="up" index={4}>
            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {/* The one inverse button on the site: solid white on black is
                  the strongest move available, so the page spends it here and
                  keeps the accent for everything else. */}
              <Cta to={signedIn ? '/dashboard' : '/sign-up'} variant="inverse">
                {signedIn ? 'Go to dashboard' : 'Start free trial'}
              </Cta>
              <Cta to="#showcase" variant="secondary">
                <PlayGlyph />
                Watch demo
              </Cta>
            </div>
          </Reveal>

          <Reveal variant="fade" index={6}>
            {/* Three separated claims rather than one run-on string — each
                reads at a glance, and the hairline dividers carry the same
                machined line the rest of the page uses. */}
            <ul className="mt-7 flex flex-wrap items-center gap-y-2 text-xs text-ink-tertiary">
              {['14-day free trial', 'No card required', 'Live in under an hour'].map(
                (claim, index) => (
                  <li key={claim} className="flex items-center">
                    {index > 0 && (
                      <span aria-hidden="true" className="mx-4 h-3 w-px bg-white/10" />
                    )}
                    {claim}
                  </li>
                ),
              )}
            </ul>
          </Reveal>
        </div>
      </Shell>

      {/* The console. Height is fixed at every breakpoint so the lazy chunk
          resolving can never shift the page, and the fold crops it on purpose. */}
      <div className="relative mt-12 md:mt-14">
        <Shell>
          <div
            className="relative mx-auto h-[420px] max-w-[1120px] sm:h-[520px] lg:h-[600px]"
            style={{ transform: `translate3d(0, ${-parallax}px, 0)`, willChange: 'transform' }}
          >
            {/* A faint accent halo behind the console's top edge. The card is
                opaque, so only the rim of the glow shows around it — enough to
                seat the panel in light instead of pasting it on black. The
                transformed parent is a stacking context, so -z-10 stays in
                front of the section background but behind the card. */}
            <div
              aria-hidden="true"
              className="absolute -inset-x-8 -top-10 bottom-1/2 -z-10"
              style={{
                background:
                  'radial-gradient(55% 60% at 50% 12%, rgba(37,99,235,0.09), transparent 70%)',
              }}
            />
            <Suspense
              fallback={
                <div
                  aria-hidden="true"
                  className="h-full rounded-xl border border-subtle bg-surface-raised"
                />
              }
            >
              <HeroDashboard />
            </Suspense>
          </div>
        </Shell>
      </div>
    </section>
  );
}
