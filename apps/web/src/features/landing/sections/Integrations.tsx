import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';

/**
 * Integrations, as wordmarks rather than logo files.
 *
 * Third-party logos carry trademark usage rules and go stale the moment a brand
 * refreshes; set in the page's own type they stay legible, theme correctly, and
 * cost nothing to load. Replace with official assets if legal signs them off.
 */
const INTEGRATIONS = [
  { name: 'Twilio', role: 'Phone numbers & call routing' },
  { name: 'OpenAI', role: 'Conversation intelligence' },
  { name: 'Google Calendar', role: 'Appointment scheduling' },
  { name: 'Outlook', role: 'Calendar & email sync' },
  { name: 'Stripe', role: 'Billing & payments' },
  { name: 'Clerk', role: 'Team accounts & access' },
  { name: 'HubSpot', role: 'CRM pipeline sync' },
  { name: 'QuickBooks', role: 'Invoicing & accounting' },
];

export function Integrations() {
  return (
    <Section id="integrations" glow="center">
      <Container>
        <SectionHeading
          eyebrow="Integrations"
          title="It fits the tools you already run on."
          lede="Connect in a few clicks. No rip-and-replace, no new system for your office manager to learn."
        />
        <RevealGroup className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {INTEGRATIONS.map(({ name, role }) => (
            <RevealItem key={name}>
              <div className="group h-full rounded-xl border border-mkt-line-subtle bg-mkt-surface p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-mkt-accent-border hover:shadow-mkt-md">
                <p className="text-[0.9375rem] font-semibold tracking-tight text-mkt-ink">{name}</p>
                <p className="mt-1 text-xs leading-relaxed text-mkt-ink-faint">{role}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
        <p className="mt-8 text-center text-sm text-mkt-ink-faint">
          Need something else? Ask us — we add integrations our customers actually use.
        </p>
      </Container>
    </Section>
  );
}
