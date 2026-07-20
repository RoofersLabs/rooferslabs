import { Bell, CalendarCheck, ClipboardList, Database, PhoneCall, Sparkles } from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';

/**
 * The call lifecycle. Numbering is meaningful here — this is a genuine sequence
 * where each step depends on the one before it, so the order carries
 * information rather than decorating the layout.
 */
const STEPS = [
  {
    icon: PhoneCall,
    title: 'A homeowner calls',
    body: 'Day, night, weekend or mid-storm. The line is answered before the second ring.',
  },
  {
    icon: Sparkles,
    title: 'The AI answers',
    body: 'A natural voice greets them with your company name and your tone — not a phone tree.',
  },
  {
    icon: ClipboardList,
    title: 'The lead is qualified',
    body: 'Name, address, roof type, damage, urgency and insurance status — captured while they talk.',
  },
  {
    icon: CalendarCheck,
    title: 'The appointment is booked',
    body: 'It checks your real availability and offers the inspection slots you actually want to fill.',
  },
  {
    icon: Database,
    title: 'Your CRM updates',
    body: 'Contact, transcript, summary and job details sync automatically. Nobody retypes anything.',
  },
  {
    icon: Bell,
    title: 'Your team is notified',
    body: 'Emergencies page you instantly. Everything else is waiting in the dashboard when you come down.',
  },
];

export function Timeline() {
  return (
    <Section id="how" glow="right">
      <Container size="narrow">
        <SectionHeading
          eyebrow="What happens on every call"
          title="One call, handled end to end — without you touching it."
        />

        <RevealGroup className="relative mt-14" stagger={0.09}>
          {/* Spine. Fades at both ends so it reads as continuous flow, not a
              hard rule that stops abruptly at the first and last icon. */}
          <span
            aria-hidden
            className="absolute left-[1.4375rem] top-2 hidden h-[calc(100%-2rem)] w-px sm:block"
            style={{
              background:
                'linear-gradient(to bottom, transparent, var(--mkt-accent-border) 8%, var(--mkt-accent-border) 92%, transparent)',
            }}
          />
          <ol className="flex flex-col gap-8">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <RevealItem key={title}>
                <li className="relative flex gap-5">
                  <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-mkt-line-subtle bg-mkt-surface shadow-mkt-sm">
                    <Icon className="h-5 w-5 text-mkt-accent" aria-hidden />
                  </span>
                  <div className="pt-1">
                    <p className="flex items-baseline gap-2.5">
                      <span className="text-[0.6875rem] font-semibold tabular-nums tracking-widest text-mkt-ink-faint">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-base font-semibold text-mkt-ink">{title}</span>
                    </p>
                    <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-mkt-ink-muted">
                      {body}
                    </p>
                  </div>
                </li>
              </RevealItem>
            ))}
          </ol>
        </RevealGroup>
      </Container>
    </Section>
  );
}
