import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Container } from '../components/Container';
import { ProductShowcase } from '../dashboard/ProductShowcase';
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
        <div className="max-w-[680px] pb-8 pt-16 text-left sm:pt-24 lg:pt-28">
          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_SMOOTH }}
            className="mb-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white/55"
          >
            AI receptionist for roofing teams
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.04 }}
            className="max-w-[12ch] text-balance text-[clamp(2.65rem,5.6vw,4.15rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-white"
          >
            <span className="block">Every call answered.</span>
            <span className="block">Every job booked.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.12 }}
            className="mt-6 max-w-[52ch] text-pretty text-[16.5px] leading-[1.65] text-mk-secondary sm:text-[17.5px]"
          >
            RoofersLabs is the AI receptionist for roofing companies. It picks up on the first ring,
            qualifies the homeowner, books the appointment, and pages your crew when it is an
            emergency, around the clock.
          </motion.p>
        </div>

        <motion.div
          // Scroll-driven values must own their own element: a motion value in
          // `style` outranks `animate`, so the entrance below gets its own node.
          style={reduced ? undefined : { y: previewY, opacity: previewOpacity }}
          className="min-h-[560px] flex-1 pb-10 sm:pb-12"
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_SMOOTH, delay: 0.2 }}
            className="h-full"
          >
            <ProductShowcase />
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
