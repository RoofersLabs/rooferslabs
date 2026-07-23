import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { ChevronDownIcon } from '../components/icons';

const QUESTIONS = [
  {
    question: 'Will callers know it isn’t a person?',
    answer:
      'Most don’t ask. It introduces itself as your front desk, speaks naturally, and hands off to a human the moment a call needs one. If someone asks directly, it tells them.',
  },
  {
    question: 'Do I have to change my phone number?',
    answer:
      'No. You forward your existing number to us, or we provision a new one and you forward selectively — after hours only, or when your line is busy.',
  },
  {
    question: 'What happens on a real emergency?',
    answer:
      'You define the rules. Active leaks, storm damage or any phrase you choose can transfer straight to a human, ring a specific crew, or escalate to your cell.',
  },
  {
    question: 'How does it know about my company?',
    answer:
      'You give it your service area, pricing, warranty and claims policy during setup. It answers from those documents and cites the source of every answer, so it never invents a price.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Under an hour for most companies. Forward the number, upload what the receptionist should know, connect your calendar, and it starts answering.',
  },
  {
    question: 'What if it books something wrong?',
    answer:
      'Every call is transcribed with the reasoning behind each decision, and appointments can be reviewed or reassigned before the crew is dispatched.',
  },
];

/**
 * Accordion.
 *
 * The open/close uses a `grid-template-rows` transition from `0fr` to `1fr`.
 * That animates to the answer's real height without measuring anything in
 * JavaScript, so it stays correct when text reflows at any breakpoint —
 * `max-height` guesswork always eases wrong at one width or another.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="resources" className="border-t border-subtle">
      <Shell>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Reveal variant="fade">
              <Eyebrow>Questions</Eyebrow>
            </Reveal>
            <Reveal variant="up" index={1}>
              <h2 className="mt-5 text-title font-medium">
                The things owners
                <br />
                actually ask us.
              </h2>
            </Reveal>
            <Reveal variant="fade" index={2}>
              <p className="mt-5 text-sm leading-relaxed text-ink-tertiary">
                Still unsure?{' '}
                <a
                  href="mailto:hello@rooferslabs.com"
                  className="text-ink-secondary underline decoration-white/20 underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
                >
                  Ask us directly
                </a>
                .
              </p>
            </Reveal>
          </div>

          <div className="border-t border-subtle">
            {QUESTIONS.map((item, index) => {
              const expanded = open === index;
              return (
                <Reveal
                  key={item.question}
                  variant="fade"
                  index={Math.min(index, 3)}
                  className="border-b border-subtle"
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`faq-answer-${index}`}
                      onClick={() => setOpen(expanded ? null : index)}
                      className="flex w-full items-center justify-between gap-6 py-5 text-left text-[0.9375rem] font-medium transition-colors duration-150 ease-out hover:text-ink-secondary"
                    >
                      {item.question}
                      <ChevronDownIcon
                        width={17}
                        height={17}
                        className={cn(
                          'shrink-0 text-ink-tertiary transition-transform duration-300 ease-out',
                          expanded && 'rotate-180',
                        )}
                      />
                    </button>
                  </h3>

                  <div
                    id={`faq-answer-${index}`}
                    role="region"
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                      expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-prose pb-6 pr-8 text-sm leading-relaxed text-ink-secondary">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Shell>
    </Section>
  );
}
