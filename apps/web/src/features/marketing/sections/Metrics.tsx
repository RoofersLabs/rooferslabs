import { Counter } from '../components/Counter';
import { Reveal } from '../components/Reveal';
import { Section, Shell } from '../components/primitives';
import { WaveField } from '../components/WaveField';
import { useInView } from '../lib/hooks';

/**
 * ⚠️ PLACEHOLDER FIGURES — replace with real platform numbers before launch.
 * Publishing invented metrics is the fastest way to lose the trust the rest of
 * this page is built to earn.
 */
const METRICS = [
  { value: 2.4, decimals: 1, suffix: 'M', label: 'Calls answered', sub: 'Since launch' },
  { value: 186, decimals: 0, suffix: 'K', label: 'Appointments booked', sub: 'Straight to the calendar' },
  { value: 94, decimals: 0, suffix: 'K', label: 'Hours saved', sub: 'Nobody had to work them' },
  { value: 1.2, decimals: 1, suffix: 's', label: 'Average response time', sub: 'First ring, every time' },
];

/**
 * The scale section: four numbers floating over a procedural wave-field.
 *
 * The composition is deliberately top-and-bottom: figures live in the upper
 * portion of the band, the wave occupies the lower ~68%, and the two overlap
 * just enough that the numbers read as suspended above a surface rather than
 * printed on a flat black card. The counters and the staggered fade-up are the
 * only entrance motion — the wave is continuous background, not an event.
 */
export function Metrics() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <Section className="overflow-hidden border-y border-subtle" label="Platform results">
      {/* The wave. Behind the Shell (which is relative), masked on every edge
          by the component itself, and purely decorative. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%]">
        <WaveField />
      </div>

      <Shell className="relative">
        <div
          ref={ref}
          className="grid grid-cols-1 gap-14 text-center sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
        >
          {METRICS.map((metric, index) => (
            <Reveal key={metric.label} variant="up" index={index}>
              <p className="text-[clamp(3rem,5.5vw,4.5rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums">
                <Counter
                  value={metric.value}
                  decimals={metric.decimals}
                  active={inView}
                  durationMs={1800}
                />
                <span className="text-accent">{metric.suffix}</span>
              </p>
              <p className="mt-5 text-sm font-medium">{metric.label}</p>
              <p className="mt-1.5 text-xs text-ink-tertiary">{metric.sub}</p>
            </Reveal>
          ))}
        </div>

        {/* Clears the water: holds the figures in the band's upper half and
            gives the wave room to breathe beneath them. */}
        <div aria-hidden="true" className="h-40 md:h-52 lg:h-64" />
      </Shell>
    </Section>
  );
}
