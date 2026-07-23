import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';
import { EASE_SMOOTH } from '../motion';

/**
 * The conversation is a free-floating composition rather than a chat window:
 * individual bubbles at different sizes and positions that overlap slightly,
 * with a field of muted monospace "system events" drifting behind them so the
 * AI reads as thinking and working at the same time. Below `lg` the absolute
 * placement collapses into a natural vertical flow and the background field is
 * dropped, which keeps the section readable and honest on a phone.
 */

type Bubble = {
  id: string;
  speaker: string;
  text: string;
  role: 'customer' | 'ai';
  /** Alignment when the composition collapses to a column below `lg`. */
  flow: string;
  /** Absolute placement and width at `lg` and up. */
  place: string;
  delay: number;
};

const BUBBLES: Bubble[] = [
  {
    id: 'c1',
    speaker: 'Customer',
    text: 'Hi, I have a roof leak after yesterday’s storm.',
    role: 'customer',
    flow: 'self-start',
    place: 'lg:left-0 lg:top-[4px] lg:w-[298px]',
    delay: 0.05,
  },
  {
    id: 'a1',
    speaker: 'AI Receptionist',
    text: 'I’m sorry to hear that. Can I have your address so I can determine if this is an emergency?',
    role: 'ai',
    flow: 'self-end',
    place: 'lg:right-0 lg:top-[92px] lg:w-[346px]',
    delay: 0.2,
  },
  {
    id: 'c2',
    speaker: 'Customer',
    text: 'It’s leaking into the living room.',
    role: 'customer',
    flow: 'self-start',
    place: 'lg:left-[22px] lg:top-[236px] lg:w-[262px]',
    delay: 0.36,
  },
  {
    id: 'a2',
    speaker: 'AI Receptionist',
    text: 'I’ve marked this as urgent. The earliest technician is available today at 2:30 PM.',
    role: 'ai',
    flow: 'self-end',
    place: 'lg:right-[6px] lg:top-[330px] lg:w-[350px]',
    delay: 0.52,
  },
];

const SYSTEM_EVENTS = [
  { text: 'call.detect_intent', place: 'left-0 top-[3%]', size: 'text-[13px]', tone: 'text-white/[0.07]' },
  { text: 'storm.priority', place: 'right-[7%] top-[11%]', size: 'text-[15px]', tone: 'text-white/[0.06]' },
  { text: 'lead.qualify', place: 'left-[15%] top-[25%]', size: 'text-[11px]', tone: 'text-white/[0.06]' },
  { text: 'customer.location_verified', place: 'right-0 top-[33%]', size: 'text-[12px]', tone: 'text-white/[0.05]' },
  { text: 'calendar.book', place: 'left-[4%] top-[47%]', size: 'text-[13px]', tone: 'text-white/[0.07]' },
  { text: 'crm.sync', place: 'right-[20%] top-[55%]', size: 'text-[11px]', tone: 'text-white/[0.06]' },
  { text: 'dispatch.notify', place: 'left-[19%] top-[69%]', size: 'text-[13px]', tone: 'text-white/[0.06]' },
  { text: 'summary.generate', place: 'right-[4%] top-[77%]', size: 'text-[12px]', tone: 'text-white/[0.05]' },
  { text: 'crew.alert_sent', place: 'left-[2%] top-[88%]', size: 'text-[11px]', tone: 'text-white/[0.06]' },
  { text: 'appointment.confirmed', place: 'right-[11%] top-[95%]', size: 'text-[14px]', tone: 'text-white/[0.05]' },
] as const;

function ConversationBubble({ bubble, reduced }: { bubble: Bubble; reduced: boolean }) {
  const isAi = bubble.role === 'ai';

  return (
    <motion.div
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px -80px 0px' }}
      transition={{ duration: 0.6, delay: reduced ? 0 : bubble.delay, ease: EASE_SMOOTH }}
      className={`relative w-fit max-w-[86%] ${bubble.flow} lg:absolute lg:max-w-none ${bubble.place}`}
    >
      <div
        className={`rounded-2xl border px-4 py-3 backdrop-blur-[2px] transition-transform duration-300 ease-smooth will-change-transform hover:-translate-y-1.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
          isAi
            ? 'border-mk-accent-ring/25 bg-mk-accent/[0.10] text-white shadow-[0_22px_55px_-34px_rgba(0,0,0,0.9)]'
            : 'border-white/[0.09] bg-white/[0.05] text-white/85 shadow-[0_22px_55px_-36px_rgba(0,0,0,0.95)]'
        }`}
      >
        <p
          className={`mb-1.5 text-[11px] font-medium tracking-[-0.005em] ${
            isAi ? 'text-mk-accent-fg' : 'text-mk-muted'
          }`}
        >
          {bubble.speaker}
        </p>
        <p className="text-[13.5px] leading-[1.55] sm:text-[14px]">{bubble.text}</p>
      </div>
    </motion.div>
  );
}

function ConfirmationChip({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px -80px 0px' }}
      transition={{ duration: 0.55, delay: reduced ? 0 : 0.68, ease: EASE_SMOOTH }}
      className="relative w-fit self-end lg:absolute lg:right-[70px] lg:top-[452px]"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-mk-accent-ring/25 bg-mk-accent/[0.10] px-3.5 py-2 backdrop-blur-[2px] shadow-[0_18px_44px_-30px_rgba(0,0,0,0.9)]">
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-mk-accent-fg"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3 8.5 3.5 3.5L13 5" />
        </svg>
        <span className="text-[12.5px] font-medium tracking-[-0.01em] text-white">
          Appointment confirmed.
        </span>
      </div>
    </motion.div>
  );
}

export function CallShowcase() {
  const reduced = Boolean(useReducedMotion());
  const canvasRef = useRef<HTMLDivElement>(null);

  // Pointer parallax. The pointer position is normalised to roughly [-1, 1]
  // across the canvas, smoothed by a spring, then split into two depths: the
  // bubbles drift a few pixels against the pointer, the background field a
  // little further with it. Both are pinned to zero under reduced motion.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 60, damping: 20, mass: 0.5 });
  const springY = useSpring(pointerY, { stiffness: 60, damping: 20, mass: 0.5 });
  const bubblesX = useTransform(springX, (v) => v * -6);
  const bubblesY = useTransform(springY, (v) => v * -5);
  const eventsX = useTransform(springX, (v) => v * 14);
  const eventsY = useTransform(springY, (v) => v * 11);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width - 0.5) * 2);
    pointerY.set(((event.clientY - rect.top) / rect.height - 0.5) * 2);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <section className="relative overflow-hidden bg-black py-[72px] sm:py-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          {/* Left — heading, paragraph, link. Nothing else. */}
          <Reveal>
            <div className="max-w-[440px]">
              <h2 className="text-balance text-[clamp(2.25rem,4.8vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
                <span className="block">Talk like your</span>
                <span className="block">best receptionist.</span>
              </h2>
              <p className="mt-6 text-[15px] leading-[1.7] text-mk-secondary sm:text-[16.5px]">
                RoofersLabs answers calls naturally, qualifies homeowners, books appointments,
                detects emergencies, and never misses an opportunity.
              </p>
              <a
                href="#how-it-works"
                className="mt-8 inline-flex text-[13.5px] font-medium text-white/80 transition-colors duration-200 ease-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
              >
                See how conversations work&nbsp;&rarr;
              </a>
            </div>
          </Reveal>

          {/* Right — free-floating conversation over a drifting event field. */}
          <div
            ref={canvasRef}
            role="group"
            aria-label="Example conversation between a homeowner and the RoofersLabs AI receptionist"
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
            className="relative"
          >
            <motion.div
              aria-hidden="true"
              style={{ x: eventsX, y: eventsY }}
              className="pointer-events-none absolute inset-0 hidden lg:block"
            >
              {SYSTEM_EVENTS.map((event, index) => (
                <motion.span
                  key={event.text}
                  initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px 0px -80px 0px' }}
                  transition={{
                    duration: 1.4,
                    delay: reduced ? 0 : 0.2 + index * 0.1,
                    ease: EASE_SMOOTH,
                  }}
                  className={`absolute whitespace-nowrap font-num tracking-[-0.01em] ${event.size} ${event.tone} ${event.place}`}
                >
                  {event.text}
                </motion.span>
              ))}
            </motion.div>

            <motion.div
              style={{ x: bubblesX, y: bubblesY }}
              className="relative z-10 flex flex-col gap-4 lg:block lg:h-[512px]"
            >
              {BUBBLES.map((bubble) => (
                <ConversationBubble key={bubble.id} bubble={bubble} reduced={reduced} />
              ))}
              <ConfirmationChip reduced={reduced} />
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
