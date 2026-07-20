import { PhoneMissed, Users, Voicemail, TrendingDown } from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';
import { MktCard, IconTile } from '../components/Card';

const PROBLEMS = [
  {
    icon: PhoneMissed,
    title: 'Missed calls',
    body: 'Your crew is on a roof, not by a phone. The homeowner calls the next contractor on the list within four minutes.',
  },
  {
    icon: Users,
    title: 'An office that can’t keep up',
    body: 'One person cannot quote, schedule, order material and answer every ring at once — so the phone loses.',
  },
  {
    icon: Voicemail,
    title: 'Voicemail nobody returns',
    body: 'Most homeowners never leave a message. The ones who do have usually booked someone else before you call back.',
  },
  {
    icon: TrendingDown,
    title: 'Revenue you never see',
    body: 'A missed call is not a small loss. At an average roof replacement, a handful a month is a six-figure hole in the year.',
  },
];

export function Problem() {
  return (
    <Section tone="subtle" bordered id="problem">
      <Container>
        <SectionHeading
          eyebrow="The cost of a ringing phone"
          title="Roofing companies don’t lose jobs on price. They lose them on pickup."
          lede="By the time you call back, the homeowner has already booked. Here is where the revenue actually goes."
        />
        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <MktCard interactive className="h-full p-6">
                <IconTile tone="muted">
                  <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                </IconTile>
                <h3 className="mt-5 text-base font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-mkt-ink-muted">{body}</p>
              </MktCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
