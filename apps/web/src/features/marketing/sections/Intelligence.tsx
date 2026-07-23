import { cn } from '@/lib/utils';
import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { useInView, useSequence } from '../lib/hooks';

/**
 * Each stage the receptionist moves through on a single call, paired with the
 * trace line it emits. Keeping the two in one array is what guarantees the left
 * column and the right column can never fall out of sync.
 */
const STAGES = [
  {
    title: 'Understands what was said',
    body: 'Storm damage, an active leak and "my roof is old" are three different calls.',
    trace: 'intent: storm_damage · confidence 0.94',
  },
  {
    title: 'Checks what your company knows',
    body: 'Service area, pricing, warranty terms and claims policy, read from your own documents.',
    trace: 'knowledge: service_area(Parma, OH) → covered',
  },
  {
    title: 'Qualifies the homeowner',
    body: 'Property type, roof age, insurance status and urgency — asked in the order that matters.',
    trace: 'lead: insurance_eligible=true · urgency=standard',
  },
  {
    title: 'Books the right slot',
    body: 'Live crew availability, travel time and job length, resolved before the call ends.',
    trace: 'schedule: Crew A · Thu 08:00–10:00 · confirmed',
  },
];

/**
 * The trust section.
 *
 * Owners are being asked to hand over their phone line, so this section is
 * built entirely around showing the model's working. Stages light up in
 * sequence once the section is reached; the trace lines land underneath as each
 * one completes.
 */
export function Intelligence() {
  const [ref, inView] = useInView<HTMLDivElement>('0px 0px -25% 0px');
  const step = useSequence(STAGES.length, inView, 1100);

  return (
    <Section className="overflow-hidden">
      {/* A single low, wide pool of light behind the section. Monochrome — it
          creates depth without introducing a second colour. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 40%, rgba(255,255,255,0.035), transparent 70%)',
        }}
      />

      <Shell className="relative">
        <div ref={ref} className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div>
            <Reveal variant="fade">
              <Eyebrow>Intelligence</Eyebrow>
            </Reveal>
            <Reveal variant="up" index={1}>
              <h2 className="mt-5 text-headline font-medium">
                It doesn’t guess.
                <br />
                <span className="text-ink-tertiary">It reasons, then acts.</span>
              </h2>
            </Reveal>

            <ol className="mt-12 space-y-1">
              {STAGES.map((stage, index) => {
                const reached = step >= index;
                return (
                  <li
                    key={stage.title}
                    className={cn(
                      'relative rounded-lg border-l-2 py-4 pl-5 pr-4 transition-[border-color,background-color,opacity] duration-500 ease-out',
                      reached
                        ? 'border-accent bg-white/[0.03] opacity-100'
                        : 'border-white/10 opacity-45',
                    )}
                  >
                    <h3 className="text-[0.9375rem] font-medium">{stage.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                      {stage.body}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          <Reveal variant="right">
            <div className="rounded-2xl border border-subtle bg-surface-raised">
              <div className="flex items-center justify-between border-b border-subtle px-5 py-3.5">
                <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-tertiary">
                  Reasoning trace
                </span>
                <span className="font-mono text-[0.6875rem] text-ink-quaternary">call_8f21c4</span>
              </div>

              {/* Fixed height so trace lines arriving never push the page. */}
              <div className="h-[19rem] space-y-3 overflow-hidden p-5 font-mono text-xs leading-relaxed">
                {STAGES.map((stage, index) => {
                  const shown = step >= index;
                  return (
                    <div
                      key={stage.trace}
                      className={cn(
                        'flex gap-3 transition-[opacity,transform] duration-500 ease-out motion-reduce:transform-none',
                        shown ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
                      )}
                    >
                      <span className="shrink-0 text-ink-quaternary">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-ink-secondary">{stage.trace}</span>
                    </div>
                  );
                })}

                <div
                  className={cn(
                    'flex gap-3 pt-2 transition-opacity duration-500 ease-out',
                    step >= STAGES.length - 1 ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  <span className="shrink-0 text-ink-quaternary">→</span>
                  <span className="text-accent">call resolved · 0 human minutes</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
}
