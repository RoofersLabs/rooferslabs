import { Counter } from '../components/Counter';
import { Reveal } from '../components/Reveal';
import { Section, Shell } from '../components/primitives';
import { useInView } from '../lib/hooks';

/**
 * ⚠️ PLACEHOLDER FIGURES — replace with real platform numbers before launch.
 * Publishing invented metrics is the fastest way to lose the trust the rest of
 * this page is built to earn.
 */
const METRICS = [
  { value: 2.4, decimals: 1, suffix: 'M', label: 'Calls answered', sub: 'Since launch' },
  { value: 186, decimals: 0, suffix: 'K', label: 'Appointments booked', sub: 'Straight to the calendar' },
  { value: 94, decimals: 0, suffix: 'K', label: 'Hours of front desk', sub: 'Nobody had to work' },
  { value: 1.2, decimals: 1, suffix: 's', label: 'Average answer time', sub: 'First ring, every time' },
];

/**
 * The confidence section: four numbers set as large as the display headline,
 * counting up once when the band enters view.
 *
 * The counters are the only motion here. A section this loud typographically
 * does not need anything else happening in it.
 */
export function Metrics() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <Section className="border-y border-subtle bg-surface" label="Platform results">
      <Shell>
        <div ref={ref} className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {METRICS.map((metric, index) => (
            <Reveal key={metric.label} variant="up" index={index}>
              <p className="text-[clamp(3rem,5.5vw,4.25rem)] font-medium leading-none tracking-[-0.045em] tabular-nums">
                <Counter
                  value={metric.value}
                  decimals={metric.decimals}
                  active={inView}
                  durationMs={1800}
                />
                <span className="text-accent">{metric.suffix}</span>
              </p>
              <p className="mt-5 text-[0.9375rem] font-medium">{metric.label}</p>
              <p className="mt-1 text-sm text-ink-tertiary">{metric.sub}</p>
            </Reveal>
          ))}
        </div>
      </Shell>
    </Section>
  );
}
