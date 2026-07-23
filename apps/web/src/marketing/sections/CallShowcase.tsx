import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';
import { EASE_SMOOTH } from '../motion';

/**
 * A whole roofing call told in three beats — the homeowner's problem, the AI's
 * understanding, and the action it takes — composed as a floating illustration
 * rather than a chat log. A field of muted monospace operations drifts behind
 * it so the single visible exchange reads as the surface of a system doing a
 * lot of work at once. Below `lg` the art direction collapses to a clean
 * vertical read and the background field is dropped.
 */

const SYSTEM_EVENTS = [
  { text: 'lead.qualify()', place: 'left-[2%] top-[5%]', size: 'text-[13px]', tone: 'text-white/[0.06]', blur: '' },
  { text: 'storm.priority = HIGH', place: 'right-[7%] top-[12%]', size: 'text-[15px]', tone: 'text-white/[0.05]', blur: '' },
  { text: 'calendar.reserve()', place: 'left-[15%] top-[29%]', size: 'text-[11px]', tone: 'text-white/[0.05]', blur: 'blur-[1px]' },
  { text: 'crm.sync()', place: 'right-[2%] top-[39%]', size: 'text-[12px]', tone: 'text-white/[0.06]', blur: '' },
  { text: 'dispatch.notify()', place: 'left-[5%] top-[55%]', size: 'text-[13px]', tone: 'text-white/[0.05]', blur: '' },
  { text: 'summary.generate()', place: 'right-[15%] top-[63%]', size: 'text-[11px]', tone: 'text-white/[0.04]', blur: 'blur-[1.5px]' },
  { text: 'crew.alert()', place: 'left-[21%] top-[78%]', size: 'text-[12px]', tone: 'text-white/[0.06]', blur: '' },
  { text: 'appointment.confirmed()', place: 'right-[5%] top-[88%]', size: 'text-[14px]', tone: 'text-white/[0.05]', blur: 'blur-[1px]' },
] as const;

const CONFIRMATIONS = ['Appointment confirmed', 'Crew notified', 'Summary sent'] as const;

// Shared hover behaviour: a soft 3px lift and a deeper shadow on a 250ms ease,
// applied to the inner card so it never fights the entrance transform framer
// owns on the wrapper.
const HOVER =
  'transition-[transform,box-shadow] duration-[250ms] ease-smooth will-change-transform hover:-translate-y-[3px] motion-reduce:transition-none motion-reduce:hover:translate-y-0';

function Check({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3.5 3.5L13 5" />
    </svg>
  );
}

function FloatingMessage({
  place,
  flow,
  delay,
  reduced,
  children,
}: {
  place: string;
  flow: string;
  delay: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px 0px -80px 0px' }}
      transition={{ duration: 0.6, delay: reduced ? 0 : delay, ease: EASE_SMOOTH }}
      className={`relative w-fit ${flow} lg:absolute lg:max-w-none ${place}`}
    >
      {children}
    </motion.div>
  );
}

export function CallShowcase() {
  const reduced = Boolean(useReducedMotion());

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

          {/* Right — a three-beat call, composed over a drifting event field. */}
          <div
            role="group"
            aria-label="How RoofersLabs handles an emergency roofing call from start to finish"
            className="relative"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
              {SYSTEM_EVENTS.map((event, index) => (
                <motion.span
                  key={event.text}
                  initial={{ opacity: reduced ? 1 : 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, margin: '-80px 0px -80px 0px' }}
                  transition={{
                    duration: 1.4,
                    delay: reduced ? 0 : 0.3 + index * 0.09,
                    ease: EASE_SMOOTH,
                  }}
                  className={`absolute whitespace-nowrap font-num tracking-[-0.01em] ${event.size} ${event.tone} ${event.blur} ${event.place}`}
                >
                  {event.text}
                </motion.span>
              ))}
            </div>

            <div className="relative z-10 flex flex-col gap-4 lg:block lg:h-[500px]">
              {/* Beat 1 — the homeowner's problem. */}
              <FloatingMessage
                place="lg:left-0 lg:top-[10px] lg:w-[262px]"
                flow="self-start max-w-[84%]"
                delay={0.05}
                reduced={reduced}
              >
                <div
                  className={`rounded-[20px] border border-white/[0.08] bg-white/[0.045] px-5 py-4 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.95)] backdrop-blur-[2px] hover:shadow-[0_28px_60px_-34px_rgba(0,0,0,0.95)] ${HOVER}`}
                >
                  <p className="mb-2 text-[11px] font-medium tracking-[-0.005em] text-mk-muted">
                    Customer
                  </p>
                  <p className="text-[14.5px] leading-[1.55] tracking-[-0.006em] text-white/85">
                    I have a roof leak after last night’s storm.
                  </p>
                </div>
              </FloatingMessage>

              {/* Beat 2 — the AI understands and resolves it. The hero bubble. */}
              <FloatingMessage
                place="lg:right-[4px] lg:top-[92px] lg:w-[382px]"
                flow="self-end max-w-[92%]"
                delay={0.24}
                reduced={reduced}
              >
                <div
                  className={`rounded-[22px] border border-mk-accent-ring/25 bg-mk-accent/[0.10] px-5 py-[18px] shadow-[0_28px_66px_-38px_rgba(0,0,0,0.95)] backdrop-blur-[2px] hover:shadow-[0_36px_78px_-34px_rgba(0,0,0,0.95)] ${HOVER}`}
                >
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium tracking-[-0.005em] text-mk-accent-fg">
                      AI Receptionist
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-mk-accent-ring/25 bg-mk-accent/[0.16] px-2 py-0.5 font-num text-[10px] uppercase tracking-[0.06em] text-mk-accent-fg">
                      <span className="h-1.5 w-1.5 rounded-full bg-mk-accent-fg" />
                      Emergency
                    </span>
                  </div>
                  <p className="text-[15px] leading-[1.55] tracking-[-0.008em] text-white">
                    I’ve identified this as an emergency. Your address has been verified and the
                    earliest technician is available today at{' '}
                    <span className="font-medium text-white">2:30 PM</span>.
                  </p>
                </div>
              </FloatingMessage>

              {/* Beat 3 — RoofersLabs takes action automatically. */}
              <FloatingMessage
                place="lg:left-[30px] lg:top-[338px] lg:w-[312px]"
                flow="self-start max-w-[84%]"
                delay={0.44}
                reduced={reduced}
              >
                <div
                  className={`rounded-[20px] border border-white/[0.09] bg-white/[0.04] px-5 py-[18px] shadow-[0_24px_58px_-38px_rgba(0,0,0,0.95)] backdrop-blur-[2px] hover:shadow-[0_32px_68px_-34px_rgba(0,0,0,0.95)] ${HOVER}`}
                >
                  <p className="mb-3 font-num text-[10.5px] font-medium uppercase tracking-[0.08em] text-mk-muted">
                    System
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {CONFIRMATIONS.map((line) => (
                      <li key={line} className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-mk-accent-ring/25 bg-mk-accent/[0.12]">
                          <Check className="h-3 w-3 text-mk-accent-fg" />
                        </span>
                        <span className="text-[13.5px] font-medium tracking-[-0.008em] text-white">
                          {line}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FloatingMessage>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
