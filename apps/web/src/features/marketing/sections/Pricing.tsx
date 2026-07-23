import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Cta, Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { CheckIcon } from '../components/icons';

/**
 * Pricing.
 *
 * Monthly figures are the real ones — they mirror `PLANS` in
 * `pages/PaymentPage.tsx`, which is what Stripe Checkout actually charges. If
 * those change, change these in the same commit; a marketing page quoting a
 * different price than the checkout is a support ticket per visitor.
 *
 * ⚠️ The annual figures are a proposed 2-months-free discount. No annual Stripe
 * prices exist yet (`infra` provisions monthly Starter and Professional only),
 * so the annual toggle currently sells a plan checkout cannot bill. Either
 * provision the annual prices or remove the toggle before launch.
 */
type Plan = {
  name: string;
  monthly: number | null;
  annual: number | null;
  blurb: string;
  features: string[];
  cta: { label: string; to: string };
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: 'Starter',
    monthly: 299,
    annual: 249,
    blurb: 'For a single crew that keeps missing the phone.',
    features: [
      'Up to 250 calls per month',
      '24/7 AI answering',
      'Lead capture and qualification',
      'Appointment booking',
      'Call transcripts and recordings',
    ],
    cta: { label: 'Start free trial', to: '/sign-up' },
  },
  {
    name: 'Professional',
    monthly: 599,
    annual: 499,
    blurb: 'For companies running multiple crews and a real pipeline.',
    features: [
      'Up to 1,000 calls per month',
      'Everything in Starter',
      'CRM and calendar integrations',
      'Emergency transfer rules',
      'Business analytics and reporting',
      'Priority support',
    ],
    cta: { label: 'Start free trial', to: '/sign-up' },
    featured: true,
  },
  {
    name: 'Enterprise',
    monthly: null,
    annual: null,
    blurb: 'For multi-location operators and franchise networks.',
    features: [
      'Unlimited call volume',
      'Multiple locations and phone numbers',
      'Custom integrations',
      'SSO and role-based access',
      'Dedicated onboarding',
    ],
    cta: { label: 'Talk to sales', to: 'mailto:sales@rooferslabs.com' },
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <Section id="pricing" className="border-t border-subtle">
      <Shell>
        <div className="max-w-2xl">
          <Reveal variant="fade">
            <Eyebrow>Pricing</Eyebrow>
          </Reveal>
          <Reveal variant="up" index={1}>
            <h2 className="mt-5 text-headline font-medium">
              One missed job pays for it.
            </h2>
          </Reveal>
          <Reveal variant="up" index={2}>
            <p className="mt-6 text-lead text-ink-secondary">
              14-day trial on every plan. No card to start, no contract to leave.
            </p>
          </Reveal>
        </div>

        <Reveal variant="fade" index={3} className="mt-10">
          {/* Segmented control. The thumb slides on a transform so the two
              labels never reflow as the selection changes. */}
          <div
            role="radiogroup"
            aria-label="Billing period"
            className="relative inline-flex rounded-md border border-subtle bg-white/[0.03] p-1"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-white/[0.08] transition-transform duration-200 ease-out"
              style={{ transform: annual ? 'translateX(100%)' : 'translateX(0)' }}
            />
            {[
              { label: 'Monthly', value: false },
              { label: 'Annual', value: true },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={annual === option.value}
                onClick={() => setAnnual(option.value)}
                className={cn(
                  'relative z-10 w-28 rounded-md py-1.5 text-sm font-medium transition-colors duration-200 ease-out',
                  annual === option.value ? 'text-ink' : 'text-ink-tertiary hover:text-ink-secondary',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-tertiary">
            {annual ? 'Two months free, billed annually.' : 'Billed monthly, cancel any time.'}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
          {PLANS.map((plan, index) => {
            const price = annual ? plan.annual : plan.monthly;

            return (
              <Reveal
                key={plan.name}
                variant="up"
                index={index}
                className={cn(
                  'flex h-full flex-col rounded-xl border p-7',
                  plan.featured
                    ? 'border-accent/40 bg-surface-raised'
                    : 'border-subtle bg-white/[0.015]',
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[0.9375rem] font-medium">{plan.name}</h3>
                  {plan.featured && (
                    <span className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                      Most popular
                    </span>
                  )}
                </div>

                {/* Reserved for two lines: without it a one-line blurb pulls
                    that card's price, button and feature list a row higher
                    than its neighbours, and the three cards stop reading as a
                    single comparable set. */}
                <p className="mt-2 min-h-[2.5rem] text-sm text-ink-tertiary">{plan.blurb}</p>

                <p className="mt-7 flex items-baseline gap-1.5">
                  {price === null ? (
                    <span className="text-3xl font-medium tracking-tight">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-medium tabular-nums tracking-tight">
                        ${price}
                      </span>
                      <span className="text-sm text-ink-tertiary">/month</span>
                    </>
                  )}
                </p>

                <Cta
                  to={plan.cta.to}
                  variant={plan.featured ? 'primary' : 'secondary'}
                  className="mt-7 w-full"
                >
                  {plan.cta.label}
                </Cta>

                <ul className="mt-8 space-y-3 border-t border-subtle pt-7">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-sm text-ink-secondary">
                      <CheckIcon
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0 text-accent"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </Shell>
    </Section>
  );
}
