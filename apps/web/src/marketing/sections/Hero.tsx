import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Container } from '../components/Container';
import { ProductShowcase } from '../dashboard/ProductShowcase';
import { EASE_SMOOTH } from '../motion';

const waveTransition = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  ease: 'easeInOut' as const,
});

function HeroSignal({ reduced }: { reduced: boolean | null }) {
  const layer = (
    d: string,
    {
      opacity,
      width,
      x,
      y,
      duration,
      delay = 0,
    }: {
      opacity: number;
      width: number;
      x: number[];
      y: number[];
      duration: number;
      delay?: number;
    },
  ) => (
    <motion.path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      initial={false}
      animate={reduced ? undefined : { x, y }}
      transition={waveTransition(duration, delay)}
      style={{ opacity }}
    />
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-16 z-0 h-[78svh] min-h-[620px] overflow-hidden text-white"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1600 760"
        preserveAspectRatio="none"
        role="presentation"
      >
        <g className="motion-reduce:opacity-60">
          {layer(
            'M -260 430 C 40 330 210 560 500 432 C 760 318 895 214 1160 304 C 1370 374 1520 292 1860 188',
            {
              opacity: 0.055,
              width: 1.25,
              x: [-90, 80, -90],
              y: [0, 18, 4, -12, 0],
              duration: 32,
            },
          )}
          {layer(
            'M -220 342 C 30 248 210 392 440 350 C 680 306 780 464 1015 388 C 1225 320 1370 408 1820 310',
            {
              opacity: 0.085,
              width: 1,
              x: [-70, 105, -70],
              y: [4, -10, 12, -4, 4],
              duration: 26,
              delay: -8,
            },
          )}
          {layer(
            'M -180 518 C 110 472 248 420 468 486 C 706 558 846 488 1045 454 C 1260 418 1428 530 1780 444',
            {
              opacity: 0.045,
              width: 0.9,
              x: [-55, 65, -55],
              y: [-2, 10, -8, 6, -2],
              duration: 38,
              delay: -14,
            },
          )}
        </g>
      </svg>
    </div>
  );
}

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
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden pt-16">
      <HeroSignal reduced={reduced} />

      <Container className="relative z-10 flex flex-1 flex-col">
        <div className="max-w-[610px] pb-8 pt-16 text-left sm:pt-24 lg:pt-28">
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
            className="max-w-[11.5ch] text-balance text-[clamp(2.45rem,5vw,3.85rem)] font-semibold leading-[1.01] tracking-[-0.035em] text-white"
          >
            <span className="block">Every missed call</span>
            <span className="block">is lost revenue.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.12 }}
            className="mt-5 max-w-[46ch] text-pretty text-[16px] leading-[1.65] text-mk-secondary sm:text-[17px]"
          >
            RoofersLabs answers roofing calls, qualifies homeowners, books appointments, and
            captures urgent leads before they move on.
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
