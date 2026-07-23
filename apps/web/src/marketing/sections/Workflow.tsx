import { useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

const STEPS = [
  {
    title: 'A customer calls',
    detail: 'A homeowner dials your number. It is 2 AM and the ceiling is dripping.',
    at: '0:00',
  },
  {
    title: 'The AI answers',
    detail: 'Picked up on the first ring, in your company’s name, with your greeting.',
    at: '0:00.4',
  },
  {
    title: 'The lead is qualified',
    detail: 'Homeowner, address, roof age, urgency, and whether you cover the area.',
    at: '1:12',
  },
  {
    title: 'The appointment is booked',
    detail: 'A real slot on your real calendar, held before the caller hangs up.',
    at: '2:04',
  },
  {
    title: 'Your crew is notified',
    detail: 'Push, SMS and email — with the transcript and the summary attached.',
    at: '2:05',
  },
] as const;

/**
 * One step on the rail.
 *
 * Each node fades up as the rail's fill reaches it, so the sequence is driven
 * by the reader's own scrolling rather than by a timer — the connection is the
 * animation, and nothing moves until it is being looked at.
 */
function Step({
  step,
  index,
  progress,
  reduced,
}: {
  step: (typeof STEPS)[number];
  index: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const start = index / STEPS.length;
  const end = start + 0.6 / STEPS.length;

  const opacity = useTransform(progress, [start, end], [0.28, 1]);
  const dotScale = useTransform(progress, [start, end], [0.7, 1]);

  return (
    <motion.li
      style={reduced ? undefined : { opacity }}
      className="relative flex-1 pl-10 md:pl-0 md:pt-14"
    >
      <motion.span
        aria-hidden="true"
        style={reduced ? undefined : { scale: dotScale }}
        className={cn(
          'absolute left-[9px] top-[5px] h-2.5 w-2.5 rounded-full bg-mk-accent-ring',
          'ring-[5px] ring-black',
          'md:left-0 md:top-[calc(3.5rem-5px)]',
        )}
      />
      <div className="md:pr-8">
        <span className="font-num text-[11.5px] tabular-nums text-mk-muted">{step.at}</span>
        <h3 className="mt-1.5 text-[17px] font-medium tracking-[-0.015em] text-white">
          {step.title}
        </h3>
        <p className="mt-1.5 max-w-[34ch] text-[14.5px] leading-[1.6] text-mk-secondary">
          {step.detail}
        </p>
      </div>
    </motion.li>
  );
}

export function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.8', 'end 0.65'],
  });

  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" className="scroll-mt-24 py-[72px] sm:py-24">
      <Container>
        <Reveal>
          <h2 className="max-w-[20ch] text-balance text-[clamp(1.75rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            One call, start to finish, without you.
          </h2>
          <p className="mt-5 max-w-[58ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:text-[16.5px]">
            The same five things happen on every call, at three in the morning as reliably as at
            three in the afternoon. You find out when it is already handled.
          </p>
        </Reveal>

        <div ref={ref} className="relative mt-14 sm:mt-16">
          {/* The rail. One track, one fill — the fill's length is the reader's
              scroll position through this section. */}
          <span
            aria-hidden="true"
            className="absolute left-[14px] top-2 h-[calc(100%-1rem)] w-px bg-mk-line md:left-0 md:top-[3.5rem] md:h-px md:w-full"
          />
          {/* The fill scales along a different axis at each breakpoint, so it is
              two elements rather than one element with a conditional transform. */}
          <motion.span
            aria-hidden="true"
            style={{ scaleY: reduced ? 1 : fill }}
            className="absolute left-[14px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-mk-accent-ring md:hidden"
          />
          <motion.span
            aria-hidden="true"
            style={{ scaleX: reduced ? 1 : fill }}
            className="absolute left-0 top-[3.5rem] hidden h-px w-full origin-left bg-mk-accent-ring md:block"
          />

          <ol className="flex flex-col gap-10 md:flex-row md:gap-0">
            {STEPS.map((step, i) => (
              <Step
                key={step.title}
                step={step}
                index={i}
                progress={scrollYProgress}
                reduced={Boolean(reduced)}
              />
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
