import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Building2, Clock, Languages, MapPin, Sparkles } from 'lucide-react';
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Counter } from '../components/Counter';

/**
 * "Purpose-built for the trade" — a pinned horizontal showcase.
 *
 * Replaces the old stacked SocialProof + Stats pair. The argument is the same
 * (what the product is, then the numbers that prove it); the presentation turns
 * it into one continuous left-to-right read so the capabilities and the metrics
 * land as a single idea rather than two unrelated bands.
 *
 * HOW THE PIN WORKS
 * The outer <section> is deliberately taller than the viewport. Inside it, one
 * `position: sticky` viewport holds still while that extra height scrolls past,
 * and the track is translated horizontally by exactly the amount of scroll
 * consumed. Vertical distance maps 1:1 to horizontal distance, which is what
 * makes it feel like scrolling rather than like an animation playing at you.
 *
 * This is NOT scroll hijacking: the page never intercepts, redirects or eases
 * the user's scroll. Scrolling stays entirely native — the only thing bound to
 * it is a transform.
 */

type Capability = { icon: LucideIcon; title: string; body: string };

/**
 * Copy is unchanged from the section this replaces; the one-line bodies restate
 * claims already made elsewhere on the page (hero, feature highlight, how it
 * works) rather than introducing new ones.
 */
const CAPABILITIES: Capability[] = [
  {
    icon: Building2,
    title: 'Built only for roofing contractors',
    body: 'Not a general answering service with a roofing skin on top.',
  },
  {
    icon: Clock,
    title: '24/7 AI receptionist',
    body: 'Nights, weekends and storm season, with nobody on a rota.',
  },
  {
    icon: MapPin,
    title: 'Works nationwide',
    body: 'Any service area, any state, on the number already on your trucks.',
  },
  {
    icon: Languages,
    title: 'Natural English-speaking AI',
    body: 'Homeowners rarely realise they are not talking to your office.',
  },
  {
    icon: Sparkles,
    title: 'Trained on roofing terminology',
    body: 'Shingles, decking, underlayment, hail — it already knows the words.',
  },
];

type Stat = {
  to: number;
  decimals?: number;
  suffix: string;
  label: string;
  sub: string;
};

const STATS: Stat[] = [
  { to: 24, suffix: '/7', label: 'Always answering', sub: 'Nights, weekends, storm season' },
  { to: 1.8, decimals: 1, suffix: 's', label: 'Average pickup', sub: 'Before the second ring' },
  { to: 100, suffix: '%', label: 'Calls answered', sub: 'No voicemail, ever' },
  { to: 10, suffix: ' min', label: 'Setup time', sub: 'Forward your line and go' },
];

/** Matches the `lg` breakpoint the rest of the page uses. */
const WIDE_QUERY = '(min-width: 1024px)';

/**
 * Whether to run the pinned horizontal treatment at all.
 *
 * False on narrow viewports and whenever the user has asked for reduced motion;
 * both fall back to a stacked vertical layout with the same content and styling.
 * The initial value is read synchronously rather than in an effect — this is a
 * client-only SPA, so reading matchMedia during the first render lands on the
 * correct layout immediately instead of painting the stacked version and then
 * jumping to the pinned one.
 */
function useHorizontalShowcase() {
  const reduced = useReducedMotion();
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return wide && !reduced;
}

/** Shared entrance. Opacity + transform only, both GPU-composited. */
const ENTER = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as const },
  },
};

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={ENTER}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      className={cn('flex shrink-0 flex-col justify-between rounded-2xl p-8', className)}
    >
      {children}
    </motion.div>
  );
}

function CapabilityCard({ icon: Icon, title, body }: Capability) {
  return (
    <Panel className="w-full border border-mkt-line bg-mkt-surface shadow-mkt-sm lg:h-[17rem] lg:w-[20rem]">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-mkt-accent-border bg-mkt-accent-soft text-mkt-accent"
        aria-hidden
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="mt-8">
        <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.01em] text-mkt-ink">
          {title}
        </h3>
        <p className="mt-2.5 text-[0.875rem] leading-relaxed text-mkt-ink-muted">{body}</p>
      </div>
    </Panel>
  );
}

/**
 * The metrics are the visual focus of the section: the numeral is the largest
 * type anywhere in it, with the label reduced to a quiet uppercase caption.
 */
function StatCard({ to, decimals, suffix, label, sub }: Stat) {
  return (
    <Panel className="w-full border border-mkt-line bg-mkt-surface-2 shadow-mkt-md lg:h-[17rem] lg:w-[18.5rem]">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-mkt-accent">
        {label}
      </p>
      <div className="mt-auto">
        <p className="text-[3.5rem] font-semibold leading-none tracking-[-0.045em] text-mkt-ink">
          <Counter to={to} suffix={suffix} decimals={decimals ?? 0} />
        </p>
        <p className="mt-4 text-[0.875rem] leading-relaxed text-mkt-ink-muted">{sub}</p>
      </div>
    </Panel>
  );
}

/** Intro panel — the section's heading, set as the first thing in the run. */
function IntroPanel() {
  return (
    <Panel className="w-full justify-center p-0 lg:h-[17rem] lg:w-[26rem] lg:pr-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-mkt-accent">
        Purpose-built for the trade
      </p>
      <h2 className="mt-5 text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-mkt-ink lg:text-[2.5rem]">
        Built for how roofing companies actually take work.
      </h2>
      <p className="mt-5 max-w-md text-pretty text-[1.0625rem] leading-[1.6] text-mkt-ink-muted">
        Not a generic answering service. Every part of it — the vocabulary, the questions, the
        escalation rules — assumes the caller has a roof problem.
      </p>
    </Panel>
  );
}

/** A hairline that separates the capability run from the metrics run. */
function TrackDivider() {
  return <div aria-hidden className="hidden w-px shrink-0 self-stretch bg-mkt-line lg:block" />;
}

export function TradeShowcase() {
  const horizontal = useHorizontalShowcase();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  // How far the track must travel: its full width minus what already fits on
  // screen. Measured rather than hardcoded so it stays correct as copy, card
  // sizes or the viewport change.
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const overflow = track.scrollWidth - window.innerWidth;
    setDistance(overflow > 0 ? overflow : 0);
  }, []);

  // useLayoutEffect, not useEffect: the section's height depends on `distance`,
  // so measuring after paint would render the section at the wrong height for
  // one frame and shove every section below it down — a visible layout shift.
  useLayoutEffect(() => {
    // Nothing to measure in the stacked layout, and no need to reset `distance`
    // either — that branch never reads it, and going narrow → wide re-measures.
    if (!horizontal) return;
    measure();
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [horizontal, measure]);

  // Progress across the section's own scroll range: 0 when its top hits the top
  // of the viewport (the pin begins), 1 when its bottom does (the pin releases).
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  // Composed into a full transform string rather than passed as framer's `x`
  // shorthand: the shorthand is applied on the main thread, while a translate3d
  // string is promoted to the compositor and keeps its frames under load.
  const transform = useMotionTemplate`translate3d(${x}px, 0, 0)`;
  // scaleX from a left origin, not an animated `width`. Width is a layout
  // property, so driving it from scroll would run layout on every frame of the
  // pin; a scale is composited and costs nothing.
  const railScale = useMotionTemplate`scaleX(${scrollYProgress})`;

  const cards = (
    <>
      <IntroPanel />
      {CAPABILITIES.map((c) => (
        <CapabilityCard key={c.title} {...c} />
      ))}
      <TrackDivider />
      {STATS.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </>
  );

  // ── Stacked fallback: narrow viewports and reduced-motion ────────────────
  // Same content, same cards, no pin and no transform.
  if (!horizontal) {
    return (
      <section
        className="mkt-ambient mkt-ambient-top relative overflow-x-clip border-t border-mkt-line-subtle bg-mkt-bg-subtle px-5 py-24 sm:px-6 sm:py-28"
        aria-label="Purpose-built for the trade"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">{cards}</div>
      </section>
    );
  }

  // ── Pinned horizontal ────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      aria-label="Purpose-built for the trade"
      className="relative border-t border-mkt-line-subtle bg-mkt-bg-subtle"
      // Dynamic and measured, so it cannot live in a class. The extra height
      // beyond the viewport IS the horizontal travel — a 1:1 mapping.
      style={{ height: `calc(100vh + ${distance}px)` }}
    >
      <div className="mkt-ambient mkt-ambient-left sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div
          ref={trackRef}
          style={{ transform, willChange: 'transform' }}
          className="flex items-center gap-5 px-[max(1.25rem,calc((100vw-72rem)/2))]"
        >
          {cards}
        </motion.div>

        {/* Progress rail. Tells the reader the run is finite and how much of it
            is left — without it a pinned section reads as a stuck page. */}
        <div
          aria-hidden
          className="absolute inset-x-[max(1.25rem,calc((100vw-72rem)/2))] bottom-16 h-px bg-mkt-line"
        >
          <motion.div
            style={{ transform: railScale, transformOrigin: 'left' }}
            className="h-px w-full bg-mkt-accent"
          />
        </div>
      </div>
    </section>
  );
}
