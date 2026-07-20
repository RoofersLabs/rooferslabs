import { PhoneForwarded, Sparkles, PhoneCall } from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';
import { MktCard, IconTile } from '../components/Card';
import { MktLinkButton } from '../components/MktButton';

/** Three steps, in order — the numbering is the setup sequence, not decoration. */
const STEPS = [
  {
    icon: PhoneForwarded,
    title: 'Forward your phone',
    body: 'Keep the number on your trucks and your yard signs. Point call forwarding at RoofersLabs and you’re live — most companies finish this in a few minutes.',
    meta: 'About 5 minutes',
  },
  {
    icon: Sparkles,
    title: 'Train the AI',
    body: 'Tell it your service area, the work you take, your pricing rules and how you want emergencies handled. It picks up your tone from there.',
    meta: 'About 15 minutes',
  },
  {
    icon: PhoneCall,
    title: 'Answer every customer',
    body: 'Calls get picked up, qualified and booked around the clock. You check the dashboard when you’re off the roof.',
    meta: 'From day one',
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="subtle" bordered>
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="Live this afternoon. Really."
          lede="No hardware, no phone system migration, no week of onboarding calls."
        />
        <RevealGroup className="mt-14 grid gap-5 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body, meta }, i) => (
            <RevealItem key={title}>
              <MktCard interactive className="h-full p-7">
                <div className="flex items-center justify-between">
                  <IconTile>
                    <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                  </IconTile>
                  <span className="text-2xl font-semibold tabular-nums text-mkt-line-strong">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-mkt-ink-muted">{body}</p>
                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-mkt-accent">
                  {meta}
                </p>
              </MktCard>
            </RevealItem>
          ))}
        </RevealGroup>
        <div className="mt-10 flex justify-center">
          <MktLinkButton to="/sign-up" size="lg">
            Start free trial
          </MktLinkButton>
        </div>
      </Container>
    </Section>
  );
}
