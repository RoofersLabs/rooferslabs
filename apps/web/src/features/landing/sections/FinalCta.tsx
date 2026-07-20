import { CheckCircle2 } from 'lucide-react';
import { Container, Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { Glow } from '../components/Glow';
import { MktLinkButton } from '../components/MktButton';

const POINTS = ['14-day free trial', 'No credit card', 'Live this afternoon'];

/**
 * Closing CTA. Forced dark in both themes — same nested-scope trick as the
 * feature highlight, so it lands as a deliberate full-stop at the end of the
 * page rather than another light band.
 */
export function FinalCta() {
  return (
    <Section className="py-10 sm:py-14 lg:py-16">
      <Container>
        <Reveal>
          <div
            className="mkt relative overflow-hidden rounded-3xl border border-mkt-line bg-mkt-bg px-6 py-16 text-center sm:px-10 sm:py-20 lg:py-24"
            data-mkt-theme="dark"
          >
            <Glow placement="center" />

            <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
              <h2 className="mkt-headline-grad text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.032em] sm:text-4xl lg:text-5xl">
                The next call is worth more than the subscription.
              </h2>
              <p className="mt-5 text-pretty text-base leading-relaxed text-mkt-ink-body sm:text-lg">
                Turn on RoofersLabs today and stop paying for marketing that drives calls nobody
                picks up.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <MktLinkButton to="/sign-up" size="lg">
                  Start free trial
                </MktLinkButton>
                <MktLinkButton to="#demo" variant="secondary" size="lg">
                  Book a demo
                </MktLinkButton>
              </div>

              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
                {POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 text-sm text-mkt-ink-muted">
                    <CheckCircle2 className="h-4 w-4 text-mkt-success" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
