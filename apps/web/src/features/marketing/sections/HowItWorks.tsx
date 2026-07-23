import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';

const STEPS = [
  {
    title: 'The phone rings',
    body: 'Forward your existing number, or use one we provision. Nothing else changes.',
    meta: 'Setup: under an hour',
  },
  {
    title: 'The AI takes the call',
    body: 'It asks what a good receptionist asks, in your voice, and knows what your company does.',
    meta: 'Answered on the first ring',
  },
  {
    title: 'The job lands on the calendar',
    body: 'Booked, assigned to a crew, confirmed by text, and written to your CRM.',
    meta: 'Before the caller hangs up',
  },
];

/**
 * Three steps, connected by a rule that draws itself left to right as the
 * section arrives — the motion is the sequence, so nothing else here moves.
 */
export function HowItWorks() {
  return (
    <Section id="solutions" className="border-t border-subtle">
      <Shell>
        <div className="max-w-3xl">
          <Reveal variant="fade">
            <Eyebrow>How it works</Eyebrow>
          </Reveal>
          <Reveal variant="up" index={1}>
            <h2 className="mt-5 text-headline font-medium">
              Three steps.
              <span className="text-ink-tertiary"> No new software for your crew.</span>
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-16">
          {/* The connector sits behind the step numbers and is drawn, not
              faded — it should read as the path a call travels. The gradient
              itself lives on the `wipe` pseudo-element in the stylesheet. */}
          <Reveal
            variant="wipe"
            className="absolute left-0 right-0 top-[1.125rem] hidden h-px md:block"
            aria-hidden
          >
            {null}
          </Reveal>

          <ol className="relative grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, index) => (
              <Reveal as="li" key={step.title} variant="up" index={index + 1}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle bg-void font-mono text-xs text-ink-secondary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-title font-medium">{step.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-secondary">
                  {step.body}
                </p>
                <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-wider text-accent">
                  {step.meta}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </Shell>
    </Section>
  );
}
