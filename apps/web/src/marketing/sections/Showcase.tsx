import { Suspense, lazy } from 'react';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

/**
 * The interactive dashboard is the heaviest thing on the page and it sits
 * below the fold, so it is split out of the initial bundle and fetched while
 * the reader is still in the hero.
 */
const ProductShowcase = lazy(() =>
  import('../dashboard/ProductShowcase').then((m) => ({ default: m.ProductShowcase })),
);

/** Reserves the dashboard's exact footprint so its arrival shifts nothing. */
function ShowcaseSkeleton() {
  return (
    <div className="min-h-[560px] overflow-hidden rounded-2xl border border-mk-line bg-[#050506]">
      <div className="h-12 border-b border-mk-line" />
      <div className="flex">
        <div className="hidden w-[168px] shrink-0 flex-col gap-2 border-r border-mk-line p-4 lg:flex">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-white/[0.05]" />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[150px] animate-pulse rounded-xl border border-mk-line bg-white/[0.025]"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading the product preview</span>
    </div>
  );
}

export function Showcase() {
  return (
    <section id="product" className="scroll-mt-24 py-20 sm:py-24">
      <Container>
        <Reveal>
          <h2 className="max-w-[20ch] text-balance text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            The front office, running itself.
          </h2>
          <p className="mt-5 max-w-[58ch] text-pretty text-[16.5px] leading-[1.65] text-mk-secondary">
            Every call becomes a record: a transcript, a qualified lead, a booked slot, and a
            notification that reaches whoever needs it. This is the real interface — open a call,
            change the day, look around.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <Suspense fallback={<ShowcaseSkeleton />}>
            <ProductShowcase />
          </Suspense>
        </Reveal>
      </Container>
    </section>
  );
}
