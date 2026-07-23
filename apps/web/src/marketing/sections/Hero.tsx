import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { HeroPreview } from '../dashboard/HeroPreview';
import { EASE_SMOOTH } from '../motion';

/**
 * The first screen. The copy earns roughly the top third and the product takes
 * the rest — the promise is easier to believe once you can see the thing that
 * makes it.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // A few percent of drift, so the preview settles behind the copy as the page
  // moves. Any more than this and it stops being parallax and starts being an
  // effect.
  const previewY = useTransform(scrollYProgress, [0, 1], ['0%', '6%']);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col pt-16">
      <Container className="flex flex-1 flex-col">
        <div className="flex flex-col items-center pb-10 pt-14 text-center sm:pt-20">
          <motion.h1
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH }}
            className="max-w-[17ch] text-balance text-[clamp(2.5rem,6.2vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-white"
          >
            Every call answered. Every job booked.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.08 }}
            className="mt-6 max-w-[56ch] text-pretty text-[17px] leading-[1.6] text-mk-secondary sm:text-[18px]"
          >
            RoofersLabs is the AI receptionist for roofing companies. It picks up on the first ring,
            qualifies the homeowner, books the appointment, and pages your crew when it is an
            emergency — around the clock.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.16 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button href="/sign-up" size="lg" className="w-full sm:w-auto">
              Get started
            </Button>
            <Button href="#how-it-works" variant="secondary" size="lg" className="w-full sm:w-auto">
              See how it works
            </Button>
          </motion.div>
        </div>

        {/* The product preview. Clipped by the viewport edge rather than given
            its own bottom margin, so it reads as continuing past the fold. */}
        <motion.div
          // Scroll-driven values must own their own element: a motion value in
          // `style` outranks `animate`, so the entrance below gets its own node.
          style={reduced ? undefined : { y: previewY, opacity: previewOpacity }}
          className="min-h-[440px] flex-1 pb-6 sm:min-h-[500px]"
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_SMOOTH, delay: 0.24 }}
            className="h-full"
          >
            <HeroPreview />
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
