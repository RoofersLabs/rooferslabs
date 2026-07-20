import { CheckCircle2, PlayCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { LiveBadge } from '../components/Badge';
import { MktLinkButton } from '../components/MktButton';
import { HeroAtmosphere } from '../components/Glow';
import { BrowserFrame, MockupFrame } from '../components/Mockup';
import { DashboardMock } from '../components/DashboardMock';

const TRUST = ['No credit card required', 'Live in under 10 minutes', 'Cancel anytime'];
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The hero is the only place on the page with a scripted entrance rather than
 * scroll reveals — everything above the fold arrives in one orchestrated
 * sequence, which is what makes the first second feel deliberate.
 */
export function Hero() {
  const reduced = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay: reduced ? 0 : delay, ease: EASE },
  });

  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <HeroAtmosphere />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.div {...rise(0)}>
          <LiveBadge>Answering roofing calls right now</LiveBadge>
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="mkt-headline-grad mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl"
        >
          Never miss another roofing lead.
        </motion.h1>

        <motion.p
          {...rise(0.16)}
          className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-mkt-ink-body sm:text-lg"
        >
          Every missed call is lost revenue. RoofersLabs answers 24/7, qualifies the homeowner,
          books the appointment, updates your CRM, and sounds just like the receptionist you
          wish you could afford.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex flex-col gap-3 sm:flex-row">
          <MktLinkButton to="/sign-up" size="lg">
            Start free trial
          </MktLinkButton>
          <MktLinkButton to="#demo" variant="secondary" size="lg">
            <PlayCircle className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            Watch live demo
          </MktLinkButton>
        </motion.div>

        <motion.ul
          {...rise(0.32)}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
        >
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-sm text-mkt-ink-muted">
              <CheckCircle2 className="h-4 w-4 text-mkt-success" aria-hidden />
              {t}
            </li>
          ))}
        </motion.ul>
      </div>

      <motion.div
        {...rise(0.4)}
        className="relative z-10 mx-auto mt-16 w-full max-w-5xl sm:mt-20"
      >
        <MockupFrame>
          <BrowserFrame>
            <DashboardMock />
          </BrowserFrame>
        </MockupFrame>
      </motion.div>
    </section>
  );
}
