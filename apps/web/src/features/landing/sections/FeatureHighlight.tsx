import { Mic, PhoneCall, ShieldCheck } from 'lucide-react';
import { Container, Section } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { MktLinkButton } from '../components/MktButton';
import { MktBadge } from '../components/Badge';
import { Glow } from '../components/Glow';
import { PhoneFrame, MockupFrame } from '../components/Mockup';

const POINTS = [
  { icon: PhoneCall, text: 'Picks up on the first ring, every time' },
  { icon: Mic, text: 'Natural voice — homeowners rarely realise' },
  { icon: ShieldCheck, text: 'Escalates active leaks to you immediately' },
];

/**
 * The dark premium panel.
 *
 * It stays dark in both page themes: re-applying `.mkt` with
 * `data-mkt-theme="dark"` on this element redeclares the whole token set for
 * its subtree, so every child renders against dark surfaces with no
 * per-element overrides and no colour hardcoded here.
 */
export function FeatureHighlight() {
  // glow="none": the panel below already sits on its own centred <Glow>, and
  // stacking a second wash behind it only greys the first.
  return (
    <Section glow="none" className="py-8 sm:py-10 lg:py-12">
      <Container>
        <Reveal>
          <div
            className="mkt relative overflow-hidden rounded-3xl border border-mkt-line bg-mkt-bg px-6 py-14 sm:px-10 sm:py-16 lg:px-16 lg:py-20"
            data-mkt-theme="dark"
          >
            <Glow placement="center" className="opacity-90" />

            <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col items-start gap-6">
                <MktBadge>The receptionist that never sleeps</MktBadge>
                <h2 className="text-balance text-3xl font-semibold leading-[1.12] tracking-[-0.03em] text-mkt-ink sm:text-4xl">
                  Your best employee answers every call at 2am.
                </h2>
                <p className="max-w-lg text-pretty text-base leading-relaxed text-mkt-ink-body">
                  Storm season doesn't keep business hours. While your crew is on a roof and your
                  office line is busy, RoofersLabs is qualifying the homeowner who just found a leak
                  — and putting them on your schedule before they call the next contractor.
                </p>
                <ul className="flex flex-col gap-3">
                  {POINTS.map(({ icon: Icon, text }) => (
                    <li
                      key={text}
                      className="flex items-center gap-3 text-[0.9375rem] text-mkt-ink-body"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-mkt-accent-border bg-mkt-accent-soft text-mkt-accent">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
                <MktLinkButton to="/sign-up" size="lg" className="mt-2">
                  Start free trial
                </MktLinkButton>
              </div>

              <MockupFrame float>
                <PhoneFrame>
                  <CallScreen />
                </PhoneFrame>
              </MockupFrame>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/** In-call screen — the moment the product is doing its job. */
function CallScreen() {
  return (
    <div className="flex min-h-[26rem] flex-col px-5 pb-6 pt-12 text-center">
      <p className="text-[0.6875rem] uppercase tracking-widest text-mkt-ink-faint">Incoming call</p>
      <p className="mt-2 text-lg font-semibold text-mkt-ink">(512) 555-0188</p>
      <p className="mt-1 text-xs text-mkt-ink-muted">Austin, TX · 2:14 AM</p>

      <div className="relative mx-auto mt-8 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-mkt-accent opacity-20" />
        <span className="absolute inset-2 rounded-full bg-mkt-accent-soft" />
        <PhoneCall className="relative h-8 w-8 text-mkt-accent" aria-hidden />
      </div>

      <p className="mt-8 text-[0.6875rem] uppercase tracking-widest text-mkt-ink-faint">
        AI receptionist
      </p>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-mkt-ink-body">
        “Thanks for calling Summit Roofing — I can get someone out to look at that leak. Is the
        water still coming in right now?”
      </p>

      <div className="mt-auto space-y-2 pt-8">
        <div className="flex items-center justify-between rounded-lg border border-mkt-line-subtle bg-mkt-surface px-3 py-2 text-[0.6875rem]">
          <span className="text-mkt-ink-faint">Status</span>
          <span className="font-medium text-mkt-warn">Emergency — escalating</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-mkt-line-subtle bg-mkt-surface px-3 py-2 text-[0.6875rem]">
          <span className="text-mkt-ink-faint">Appointment</span>
          <span className="font-medium text-mkt-success">Today, 7:30 AM</span>
        </div>
      </div>
    </div>
  );
}
