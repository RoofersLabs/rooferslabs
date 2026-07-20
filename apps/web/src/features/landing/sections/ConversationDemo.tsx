import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion, motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Section, SectionHeading } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { MktBadge } from '../components/Badge';

type Turn = { from: 'caller' | 'ai'; text: string };

/** A real qualification flow: urgency, then address, then the booking. */
const SCRIPT: Turn[] = [
  { from: 'ai', text: 'Summit Roofing, this is the front desk — how can I help?' },
  {
    from: 'caller',
    text: 'Hi, I’ve got water coming through my ceiling after last night’s storm.',
  },
  { from: 'ai', text: 'That sounds urgent — is it still actively dripping right now?' },
  { from: 'caller', text: 'Yeah, into a bucket in the back bedroom.' },
  {
    from: 'ai',
    text: 'Understood. I’m flagging this as an emergency. What’s the property address?',
  },
  { from: 'caller', text: '4418 Oak Ridge Drive, Cedar Park.' },
  {
    from: 'ai',
    text: 'Got it. I can have an inspector out at 7:30 this morning — does that work?',
  },
  { from: 'caller', text: 'That would be great, thank you.' },
  {
    from: 'ai',
    text: 'Booked. You’ll get a text confirmation, and I’ve alerted the on-call crew.',
  },
];

const OUTCOMES = [
  { icon: CalendarCheck, label: 'Inspection booked', value: 'Today, 7:30 AM' },
  { icon: CheckCircle2, label: 'Lead qualified', value: 'Emergency · storm damage' },
];

export function ConversationDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);

  // Plays once, on entry. Reduced motion gets the finished transcript
  // immediately (derived below) — the content is the point, the pacing is
  // decoration, so it needs no effect and no timers at all.
  useEffect(() => {
    if (!inView || reduced) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const advance = (i: number) => {
      if (cancelled || i >= SCRIPT.length) {
        setTyping(false);
        return;
      }
      setTyping(true);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setTyping(false);
          setShown(i + 1);
          timers.push(setTimeout(() => advance(i + 1), 500));
        }, 750),
      );
    };
    timers.push(setTimeout(() => advance(0), 250));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView, reduced]);

  // Reduced motion shows the full transcript with no playback.
  const visible = reduced ? SCRIPT.length : shown;

  return (
    <Section id="demo" glow="left">
      <Container size="narrow">
        <SectionHeading
          eyebrow="Live demo"
          title="This is what your customers hear."
          lede="A real qualification flow, start to finish. Nine turns, forty seconds, one booked inspection."
        />

        <Reveal className="mt-14">
          <div
            ref={ref}
            className="overflow-hidden rounded-3xl border border-mkt-line-subtle bg-mkt-surface shadow-mkt-lg"
          >
            <div className="flex items-center justify-between border-b border-mkt-line-subtle bg-mkt-bg-subtle px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-mkt-success" aria-hidden />
                <span className="text-[0.8125rem] font-medium text-mkt-ink">
                  Incoming call · (512) 555-0188
                </span>
              </div>
              <MktBadge tone="neutral" className="hidden sm:inline-flex">
                2:14 AM
              </MktBadge>
            </div>

            <div
              className="flex min-h-[24rem] flex-col gap-3 p-5 sm:p-6"
              aria-live="polite"
              aria-label="Example conversation between a homeowner and the AI receptionist"
            >
              {SCRIPT.slice(0, visible).map((t, i) => (
                <Bubble key={i} turn={t} />
              ))}

              <AnimatePresence>
                {typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'flex',
                      SCRIPT[visible]?.from === 'caller' ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <span className="flex items-center gap-1 rounded-2xl bg-mkt-bg-subtle px-4 py-3">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-mkt-ink-faint"
                          style={{ animationDelay: `${d * 0.15}s` }}
                        />
                      ))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {visible === SCRIPT.length && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="mt-auto grid gap-2.5 border-t border-mkt-line-subtle pt-5 sm:grid-cols-2"
                >
                  {OUTCOMES.map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-mkt-line-subtle bg-mkt-bg-subtle px-4 py-3"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-mkt-success" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[0.6875rem] uppercase tracking-wide text-mkt-ink-faint">
                          {label}
                        </span>
                        <span className="block truncate text-[0.8125rem] font-medium text-mkt-ink">
                          {value}
                        </span>
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const isAi = turn.from === 'ai';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex', isAi ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-[85%] sm:max-w-[75%]', isAi && 'text-right')}>
        <span className="mb-1 block px-1 text-[0.625rem] uppercase tracking-wider text-mkt-ink-faint">
          {isAi ? 'RoofersLabs AI' : 'Homeowner'}
        </span>
        <p
          className={cn(
            'rounded-2xl px-4 py-2.5 text-left text-[0.875rem] leading-relaxed',
            isAi
              ? 'bg-mkt-cta text-mkt-accent-ink'
              : 'border border-mkt-line-subtle bg-mkt-bg-subtle text-mkt-ink-body',
          )}
        >
          {turn.text}
        </p>
      </div>
    </motion.div>
  );
}
