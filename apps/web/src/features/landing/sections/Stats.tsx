import { Container, Section } from '../components/Section';
import { Counter } from '../components/Counter';
import { RevealGroup, RevealItem } from '../components/Reveal';

/**
 * Only the numeral animates. Counting "24" up to 24/7 reads as a metric;
 * animating the whole string reads as a gimmick.
 */
const STATS = [
  { to: 24, suffix: '/7', label: 'Always answering', sub: 'Nights, weekends, storm season' },
  { to: 1.8, decimals: 1, suffix: 's', label: 'Average pickup', sub: 'Before the second ring' },
  { to: 100, suffix: '%', label: 'Calls answered', sub: 'No voicemail, ever' },
  { to: 10, suffix: ' min', label: 'Setup time', sub: 'Forward your line and go' },
];

export function Stats() {
  return (
    <Section className="py-16 sm:py-20 lg:py-24">
      <Container>
        <RevealGroup className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <RevealItem key={s.label} className="flex flex-col items-center text-center">
              <p className="text-4xl font-semibold tracking-[-0.03em] text-mkt-ink sm:text-5xl">
                <Counter to={s.to} suffix={s.suffix} decimals={s.decimals ?? 0} />
              </p>
              <p className="mt-2.5 text-sm font-medium text-mkt-ink">{s.label}</p>
              <p className="mt-1 text-[0.8125rem] text-mkt-ink-faint">{s.sub}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
