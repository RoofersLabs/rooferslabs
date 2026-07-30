import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

/**
 * The closing section. Rather than a lone headline, it hands the reader three
 * clear next steps — start now, understand pricing, or see the setup — as one
 * unified band of columns divided by hairlines, so the page ends on confidence
 * and clarity instead of urgency. It collapses to a centred stack on mobile
 * with the primary call to action first.
 */

/** A text link that eases a few pixels to the right and brightens on hover. */
function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-white/80 transition-[transform,color] duration-200 ease-smooth hover:translate-x-[3px] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black motion-reduce:transform-none motion-reduce:transition-none"
    >
      {children}
      <span aria-hidden="true">&rarr;</span>
    </a>
  );
}

function PricingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[22px] w-[22px] text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
      <path d="M2.75 9.5h18.5" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

function DeployIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[22px] w-[22px] text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2.5 4 13.5h7l-1 8 9-11h-7l1-8Z" />
    </svg>
  );
}

/** The two supporting columns share one layout; only their content differs. */
function SupportColumn({
  icon,
  heading,
  body,
  linkHref,
  linkLabel,
  className,
}: {
  icon: ReactNode;
  heading: string;
  body: string;
  linkHref: string;
  linkLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center text-center md:items-start md:text-left ${className ?? ''}`}
    >
      {icon}
      <h3 className="mt-5 text-[17px] font-medium tracking-[-0.015em] text-white">{heading}</h3>
      <p className="mt-2.5 max-w-[34ch] text-[14.5px] leading-[1.65] text-mk-secondary">{body}</p>
      <div className="mt-5">
        <ArrowLink href={linkHref}>{linkLabel}</ArrowLink>
      </div>
    </div>
  );
}

export function FinalCta() {
  return (
    <section className="border-t border-mk-line py-[72px] sm:py-28">
      <Container>
        <Reveal>
          <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-0">
            {/* Primary call to action. */}
            <div className="text-center md:pr-8 md:text-left lg:pr-12">
              <h2 className="mx-auto max-w-[14ch] text-balance text-[clamp(1.8rem,3.2vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white md:mx-0">
                Ready to never miss another call?
              </h2>
              <p className="mx-auto mt-5 max-w-[42ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary md:mx-0 sm:text-[16px]">
                Put an intelligent front desk on your phones around the clock — qualifying
                homeowners, booking appointments, and alerting your team the moment it matters.
              </p>
              <div className="mt-8">
                <Button href="/sign-up" size="lg">
                  Get started
                </Button>
              </div>
              <div className="mt-5">
                <ArrowLink href="mailto:hello@rooferslabs.com">Talk to sales</ArrowLink>
              </div>
            </div>

            {/* Pricing. */}
            <SupportColumn
              icon={<PricingIcon />}
              heading="See how pricing works"
              body="Simple monthly pricing with no hidden fees, contracts, or per-call surprises."
              linkHref="#pricing"
              linkLabel="View pricing"
              className="md:border-l md:border-mk-line md:px-8 lg:px-12"
            />

            {/* Setup. */}
            <SupportColumn
              icon={<DeployIcon />}
              heading="Deploy in minutes"
              body="Connect your number, configure your front desk, and start answering every call in minutes."
              linkHref="#how-it-works"
              linkLabel="See how it works"
              className="md:border-l md:border-mk-line md:pl-8 lg:pl-12"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
