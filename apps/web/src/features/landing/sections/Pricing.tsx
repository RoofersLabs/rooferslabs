import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';
import { MktLinkButton } from '../components/MktButton';
import { MktBadge } from '../components/Badge';

const PLANS = [
  {
    name: 'Starter',
    price: '$299',
    cadence: '/month',
    blurb: 'For owner-operators and small crews who just cannot keep missing calls.',
    cta: 'Start free trial',
    to: '/sign-up',
    featured: false,
    features: [
      'Up to 250 calls per month',
      '24/7 AI call answering',
      'Lead qualification & summaries',
      'Appointment booking',
      'Call recordings & transcripts',
      'Email & SMS notifications',
    ],
  },
  {
    name: 'Professional',
    price: '$599',
    cadence: '/month',
    blurb: 'For established companies running multiple crews through storm season.',
    cta: 'Start free trial',
    to: '/sign-up',
    featured: true,
    features: [
      'Up to 1,000 calls per month',
      'Everything in Starter',
      'CRM sync (HubSpot, QuickBooks)',
      'Calendar sync & smart scheduling',
      'Emergency escalation rules',
      'Custom knowledge base',
      'Analytics & reporting',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    blurb: 'For multi-location roofing companies and franchise groups.',
    cta: 'Book a demo',
    to: '#demo',
    featured: false,
    features: [
      'Unlimited calls',
      'Everything in Professional',
      'Multi-location routing',
      'Dedicated phone numbers per branch',
      'Custom integrations & API access',
      'SLA & dedicated success manager',
      'Onboarding and team training',
    ],
  },
];

export function Pricing() {
  return (
    <Section id="pricing" tone="subtle" bordered>
      <Container>
        <SectionHeading
          eyebrow="Pricing"
          title="Cheaper than the jobs you're already losing."
          lede="One booked roof usually covers the year. Every plan starts with a 14-day free trial — no credit card."
        />

        <RevealGroup className="mt-14 grid items-start gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <RevealItem key={p.name}>
              <div
                className={cn(
                  'relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300',
                  p.featured
                    ? 'mkt-grad-edge border-mkt-accent-border bg-mkt-surface shadow-mkt-xl lg:-my-3 lg:py-10'
                    : 'border-mkt-line-subtle bg-mkt-surface shadow-mkt-sm hover:border-mkt-line hover:shadow-mkt-md',
                )}
              >
                {p.featured && (
                  <MktBadge className="absolute -top-3 left-7 shadow-mkt-sm">Most popular</MktBadge>
                )}

                <h3 className="text-base font-semibold text-mkt-ink">{p.name}</h3>
                <p className="mt-1.5 min-h-[2.75rem] text-[0.8125rem] leading-relaxed text-mkt-ink-muted">
                  {p.blurb}
                </p>

                <p className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-[-0.03em] text-mkt-ink">
                    {p.price}
                  </span>
                  {p.cadence && (
                    <span className="text-sm text-mkt-ink-faint">{p.cadence}</span>
                  )}
                </p>

                <MktLinkButton
                  to={p.to}
                  variant={p.featured ? 'primary' : 'secondary'}
                  size="md"
                  className="mt-6 w-full"
                >
                  {p.cta}
                </MktLinkButton>

                <ul className="mt-7 flex flex-col gap-3 border-t border-mkt-line-subtle pt-7">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[0.875rem] text-mkt-ink-body">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-mkt-success" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <p className="mt-10 text-center text-sm text-mkt-ink-faint">
          Prices in USD. Cancel any time — no contracts, no cancellation fees.
        </p>
      </Container>
    </Section>
  );
}
