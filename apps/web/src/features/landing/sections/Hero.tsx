import { motion, useReducedMotion } from 'framer-motion';
import { MktLinkButton } from '../components/MktButton';
import { HeroAtmosphere } from '../components/Glow';
import { BrowserFrame, MockupFrame } from '../components/Mockup';
import { DashboardMock } from '../components/DashboardMock';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The hero is the only place on the page with a scripted entrance rather than
 * scroll reveals — everything above the fold arrives in one short sequence.
 *
 * Composition is deliberately five elements and nothing else: headline,
 * paragraph, primary CTA, quiet secondary CTA, product. Anything added here —
 * a badge, a trust row, a logo strip — costs the headline the silence it needs
 * to land, so it belongs in a section below instead.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: reduced ? 0 : delay, ease: EASE },
  });

  return (
    <section className="relative px-6 pb-24 pt-24 sm:pt-32 lg:px-8 lg:pb-32 lg:pt-40 xl:pt-48">
      <HeroAtmosphere />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.h1
          {...rise(0)}
          className="text-balance text-mkt-display-sm text-mkt-ink sm:text-mkt-display-md lg:text-mkt-display"
        >
          Never miss another roofing lead.
        </motion.h1>

        <motion.p
          {...rise(0.06)}
          className="mt-8 max-w-2xl text-pretty text-mkt-lede-sm text-mkt-ink-muted sm:text-mkt-lede lg:mt-10"
        >
          Every missed call is lost revenue. RoofersLabs answers 24/7, qualifies the homeowner,
          books the appointment, and updates your CRM — in a voice that sounds just like the
          receptionist you wish you could afford.
        </motion.p>

        <motion.div
          {...rise(0.12)}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:mt-12"
        >
          <MktLinkButton to="/sign-up" size="lg">
            Start free trial
          </MktLinkButton>
          {/* Quiet by construction: no fill, no border, and the arrow is the
              only thing that moves. It should read as an option, not an offer. */}
          <MktLinkButton to="#demo" variant="ghost" size="lg" className="group">
            Watch live demo
            <span
              aria-hidden
              className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            >
              →
            </span>
          </MktLinkButton>
        </motion.div>
      </div>

      <motion.div
        {...rise(0.2)}
        className="relative z-10 mx-auto mt-24 w-full max-w-4xl sm:mt-28 lg:mt-36"
      >
        <MockupFrame glow={false}>
          <BrowserFrame>
            <DashboardMock />
          </BrowserFrame>
        </MockupFrame>
      </motion.div>
    </section>
  );
}
