import { useState } from 'react';
import { BarChart3, Bell, BookOpen, CalendarClock, Phone, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Section, SectionHeading } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { BrowserFrame, MockupFrame } from '../components/Mockup';
import { DashboardMock } from '../components/DashboardMock';

const AREAS = [
  {
    icon: Phone,
    label: 'Calls',
    body: 'Every conversation with a recording, transcript and a summary you can read in ten seconds.',
  },
  {
    icon: Users,
    label: 'Customers',
    body: 'Each caller becomes a contact with full history — no duplicate entry, no lost numbers.',
  },
  {
    icon: CalendarClock,
    label: 'Appointments',
    body: 'Inspections and estimates on one schedule, synced to the calendar your crew already uses.',
  },
  {
    icon: BookOpen,
    label: 'Knowledge base',
    body: 'Teach the AI your services, service area, pricing rules and the answers you give every day.',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    body: 'Call volume, booking rate, response time and where your leads are actually coming from.',
  },
  {
    icon: Bell,
    label: 'Notifications',
    body: 'Emergencies reach you instantly by push and SMS. Routine leads wait quietly in the queue.',
  },
  {
    icon: Settings,
    label: 'Settings',
    body: 'Voice, greeting, hours, escalation rules and who gets woken up — all under your control.',
  },
];

export function DashboardShowcase() {
  const [active, setActive] = useState(0);

  return (
    <Section id="product" tone="subtle" bordered glow="center">
      <Container>
        <SectionHeading
          eyebrow="Your front office, in one place"
          title="Everything the AI hears, organised the way you work."
          lede="No new process to learn. Open it once a day and see exactly what came in, what got booked, and what needs you."
        />

        <Reveal className="mt-14">
          <MockupFrame>
            <BrowserFrame>
              <DashboardMock />
            </BrowserFrame>
          </MockupFrame>
        </Reveal>

        <Reveal className="mt-12" delay={0.1}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map(({ icon: Icon, label, body }, i) => (
              <li key={label}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-pressed={active === i}
                  className={cn(
                    'mkt-focus-ring h-full w-full rounded-xl border p-4 text-left transition-all duration-300',
                    active === i
                      ? 'border-mkt-accent-border bg-mkt-surface shadow-mkt-md'
                      : 'border-mkt-line-subtle bg-transparent hover:bg-mkt-surface',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        active === i ? 'text-mkt-accent' : 'text-mkt-ink-faint',
                      )}
                      aria-hidden
                    />
                    <span className="text-sm font-semibold text-mkt-ink">{label}</span>
                  </span>
                  <span className="mt-2 block text-[0.8125rem] leading-relaxed text-mkt-ink-muted">
                    {body}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}
