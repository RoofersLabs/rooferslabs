import { motion, useReducedMotion } from 'framer-motion';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';
import { EASE_SMOOTH } from '../motion';

const CONVERSATION = [
  {
    speaker: 'Customer',
    text: "Hi, I have a roof leak after yesterday's storm.",
    align: 'left',
  },
  {
    speaker: 'AI Receptionist',
    text: "I'm sorry to hear that. May I have your address so I can check if this is an emergency?",
    align: 'right',
  },
  {
    speaker: 'Customer',
    text: "It's leaking into the living room.",
    align: 'left',
  },
  {
    speaker: 'AI Receptionist',
    text: "I've marked this as urgent and notified your roofing team. The earliest technician is available at 2:30 PM today.",
    align: 'right',
  },
] as const;

const STATUSES = [
  'Lead Qualified',
  'Emergency Detected',
  'Appointment Booked',
  'Crew Notified',
  'CRM Updated',
] as const;

const SYSTEM_EVENTS = [
  { text: 'Analyzing homeowner intent', className: 'left-6 top-8' },
  { text: 'Checking calendar availability', className: 'right-8 top-20' },
  { text: 'Lead score: High', className: 'left-10 top-[46%]' },
  { text: 'Dispatching technician', className: 'right-6 bottom-28' },
  { text: 'Generating call summary', className: 'left-16 bottom-12' },
  { text: 'Appointment confirmed', className: 'right-16 bottom-8' },
] as const;

function SystemEvent({
  event,
  index,
  reduced,
}: {
  event: (typeof SYSTEM_EVENTS)[number];
  index: number;
  reduced: boolean;
}) {
  return (
    <motion.span
      aria-hidden="true"
      className={`absolute hidden font-num text-[11px] text-white/10 lg:block ${event.className}`}
      initial={{ opacity: reduced ? 0.08 : 0 }}
      whileInView={
        reduced
          ? { opacity: 0.08 }
          : {
              opacity: [0, 0.08, 0.05],
              y: [4, 0, 0],
            }
      }
      viewport={{ once: true, margin: '-96px 0px -96px 0px' }}
      transition={{
        duration: 1.8,
        delay: 0.18 + index * 0.12,
        ease: EASE_SMOOTH,
      }}
    >
      {event.text}
    </motion.span>
  );
}

function ConversationBubble({
  message,
  index,
  reduced,
}: {
  message: (typeof CONVERSATION)[number];
  index: number;
  reduced: boolean;
}) {
  const isAi = message.align === 'right';

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-96px 0px -96px 0px' }}
      transition={{ duration: 0.62, delay: 0.18 + index * 0.12, ease: EASE_SMOOTH }}
      className={`flex ${isAi ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl border px-4 py-3 ${
          isAi
            ? 'border-mk-accent-ring/25 bg-mk-accent/[0.13] text-white shadow-[0_16px_50px_-34px_rgba(79,125,255,0.55)]'
            : 'border-mk-line bg-white/[0.04] text-white/88'
        }`}
      >
        <p className={`mb-1.5 text-[11px] font-medium ${isAi ? 'text-mk-accent-fg' : 'text-mk-muted'}`}>
          {message.speaker}
        </p>
        <p className="text-[14px] leading-[1.55]">{message.text}</p>
      </div>
    </motion.div>
  );
}

export function CallShowcase() {
  const reduced = Boolean(useReducedMotion());

  return (
    <section className="relative overflow-hidden bg-black py-[72px] sm:py-32">
      <Container>
        <Reveal className="mx-auto max-w-[820px] text-center">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-white/55">
            AI receptionist for roofers
          </p>
          <h2 className="mt-6 text-balance text-[clamp(1.95rem,5vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.04em]">
            <span className="block text-white">Every conversation.</span>
            <span className="block text-white/70">Handled professionally.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[58ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:text-[17px]">
            RoofersLabs answers calls, qualifies homeowners, books appointments, and escalates
            emergencies automatically.
          </p>
        </Reveal>

        <div className="mt-16 grid items-center gap-12 lg:mt-24 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] lg:gap-20">
          <Reveal>
            <div className="max-w-[500px]">
              <h3 className="max-w-[15ch] text-balance text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-white">
                Talk like your best receptionist.
              </h3>
              <p className="mt-5 text-[15px] leading-[1.7] text-mk-secondary sm:text-[16px]">
                RoofersLabs sounds natural, understands roofing terminology, asks qualifying
                questions, books appointments, detects emergencies, and never misses an
                opportunity.
              </p>
              <a
                href="#how-it-works"
                className="mt-8 inline-flex text-[13.5px] font-medium text-white/80 transition-colors duration-200 ease-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
              >
                See how conversations work&nbsp;&rarr;
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div
              role="region"
              aria-label="AI receptionist call example"
              tabIndex={0}
              className="-mx-6 overflow-x-auto overscroll-x-contain px-6 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
            >
              <div className="relative min-w-[520px] lg:min-w-0">
                {SYSTEM_EVENTS.map((event, index) => (
                  <SystemEvent key={event.text} event={event} index={index} reduced={reduced} />
                ))}

                <div className="relative border border-mk-line bg-[#050506] p-4 shadow-[0_40px_120px_-54px_rgba(255,255,255,0.22)] sm:p-5">
                  <div className="flex h-12 items-center gap-3 border-b border-mk-line px-1 pb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-mk-line bg-white/[0.05] text-[11px] font-semibold text-white/80">
                      AI
                    </div>
                    <div>
                      <p className="text-[13px] font-medium tracking-[-0.01em] text-white">
                        RoofersLabs Receptionist
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-white/45">Live storm call</p>
                    </div>
                    <span className="ml-auto rounded-full border border-mk-accent-ring/25 bg-mk-accent/[0.12] px-2.5 py-1 font-num text-[11px] text-mk-accent-fg">
                      Active
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 py-5">
                    {CONVERSATION.map((message, index) => (
                      <ConversationBubble
                        key={`${message.speaker}-${message.text}`}
                        message={message}
                        index={index}
                        reduced={reduced}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-5 gap-2 border-t border-mk-line pt-4">
                    {STATUSES.map((status, index) => (
                      <motion.div
                        key={status}
                        initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-96px 0px -96px 0px' }}
                        transition={{
                          duration: 0.55,
                          delay: 0.66 + index * 0.06,
                          ease: EASE_SMOOTH,
                        }}
                        className="min-h-[72px] border border-mk-line bg-white/[0.025] p-3 transition-[transform,border-color,background-color] duration-200 ease-smooth hover:-translate-y-0.5 hover:border-mk-line-strong hover:bg-white/[0.045] motion-reduce:transition-colors"
                      >
                        <span className="block h-1.5 w-1.5 rounded-full bg-mk-accent-fg" />
                        <p className="mt-3 text-[11.5px] font-medium leading-[1.25] text-white/78">
                          {status}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
