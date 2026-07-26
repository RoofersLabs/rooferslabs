import { Button } from '../components/Button';
import { Container } from '../components/Container';
import { Reveal, Stagger, StaggerItem } from '../components/Reveal';

/**
 * The comparison is written in plain values rather than ticks and crosses.
 * "Business hours" against "Always" argues the case by itself; a column of
 * green checks against a column of red crosses argues nothing and fails the
 * moment colour is unavailable.
 */
const COMPARISON = [
  {
    capability: '24/7 availability',
    human: 'Business hours, minus lunch',
    ai: 'Every hour of every day',
  },
  {
    capability: 'Never misses calls',
    human: 'Busy, on a break, or out sick',
    ai: 'Every call, on the first ring',
  },
  {
    capability: 'Instant appointment booking',
    human: 'Takes a message, calls back later',
    ai: 'Booked before the caller hangs up',
  },
  {
    capability: 'AI lead qualification',
    human: 'Depends who picked up',
    ai: 'The same questions, every time',
  },
  {
    capability: 'Automatic follow-ups',
    human: 'When somebody remembers',
    ai: 'Sent without being asked',
  },
  {
    capability: 'Consistent customer experience',
    human: 'Varies with the day',
    ai: 'Identical on call 1 and call 1,000',
  },
  {
    capability: 'Lower operating cost',
    human: '$38,000+ a year, one seat',
    ai: '$299 a month, no seats to staff',
  },
] as const;

const INCLUDED = [
  '24/7 AI answering in your company’s name',
  'Lead qualification and scoring on every call',
  'Appointment booking straight onto your calendar',
  'Emergency detection and crew paging',
  'Full transcripts, recordings and written summaries',
  'Push, SMS and email notifications',
  'Unlimited team members — no per-seat pricing',
  'Call analytics and lead reporting',
] as const;

function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-[3px] h-3.5 w-3.5 shrink-0 text-mk-accent-fg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3.5 3.5L13 5" />
    </svg>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 py-[72px] sm:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-[20ch] text-balance text-[clamp(1.75rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            What a receptionist can’t do at 2 AM.
          </h2>
          <p className="mt-5 max-w-[58ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:text-[16.5px]">
            Nothing here is a criticism of the person answering your phone. It is a description of
            what one person, working reasonable hours, physically cannot cover.
          </p>
        </Reveal>

        {/* Comparison */}
        {/* The outer border is a touch thicker and brighter than the internal
            dividers so the card reads as one defined object; the radial wash is
            a top-lit ambient gradient — center ~3% white falling to pure black —
            that gives depth without ever stopping reading as black. */}
        <Reveal
          delay={0.08}
          className="mt-12 overflow-hidden rounded-2xl border border-mk-line-strong bg-[radial-gradient(115%_120%_at_50%_0%,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.012)_40%,#000000_78%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_60px_-34px_rgba(0,0,0,0.9)] sm:mt-14"
        >
          {/* One table in the DOM at every width. Below `md` the rows become
              blocks and each value carries its own label, because three columns
              on a phone collapses into four-word-per-line rubble. The labels are
              the same strings as the column headers, so nothing is duplicated
              into a second hidden copy of the table. */}
          <table
            aria-label="Traditional receptionist compared with RoofersLabs AI"
            className="w-full border-collapse text-left max-md:block"
          >
            <thead className="max-md:hidden">
              <tr className="border-b border-mk-line">
                <th
                  scope="col"
                  className="w-[36%] px-4 py-4 text-[11px] font-medium uppercase tracking-[0.07em] text-mk-muted sm:px-6"
                >
                  Capability
                </th>
                <th
                  scope="col"
                  className="px-4 py-4 text-[12.5px] font-medium text-white/70 sm:px-6 sm:text-[13.5px]"
                >
                  Traditional receptionist
                </th>
                <th
                  scope="col"
                  className="border-x border-mk-line bg-white/[0.03] px-4 py-4 text-[12.5px] font-medium text-white sm:px-6 sm:text-[13.5px]"
                >
                  RoofersLabs AI
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {COMPARISON.map((row) => (
                <tr
                  key={row.capability}
                  className="border-b border-mk-line transition-colors duration-300 ease-smooth last:border-b-0 hover:bg-white/[0.045] max-md:block max-md:px-5 max-md:py-5"
                >
                  <th
                    scope="row"
                    className="px-4 py-4 align-top text-[13px] font-medium text-white sm:px-6 sm:text-[14px] max-md:block max-md:px-0 max-md:pb-3 max-md:pt-0 max-md:text-[15px]"
                  >
                    {row.capability}
                  </th>
                  <td className="px-4 py-4 align-top text-[12.5px] leading-[1.5] text-mk-secondary sm:px-6 sm:text-[14px] max-md:block max-md:px-0 max-md:py-0">
                    <span className="mb-1 hidden text-[11px] uppercase tracking-[0.06em] text-mk-muted max-md:block">
                      Traditional receptionist
                    </span>
                    {row.human}
                  </td>
                  <td className="border-x border-mk-line bg-white/[0.03] px-4 py-4 align-top sm:px-6 max-md:mt-3 max-md:block max-md:rounded-lg max-md:border-x-0 max-md:bg-white/[0.05] max-md:p-3">
                    <span className="mb-1 hidden text-[11px] uppercase tracking-[0.06em] text-mk-accent-fg max-md:block">
                      RoofersLabs AI
                    </span>
                    <span className="flex gap-2 text-[12.5px] leading-[1.5] text-white sm:text-[14px]">
                      <Check />
                      {row.ai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        {/* Pricing */}
        <Reveal delay={0.1} className="mt-14 sm:mt-16">
          <div className="mx-auto max-w-[720px] overflow-hidden rounded-2xl border border-mk-line bg-mk-card">
            <div className="grid grid-cols-1 items-center gap-8 p-8 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
              <div>
                <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">
                  Everything, in one plan
                </h3>
                <p className="mt-2 max-w-[34ch] text-[14.5px] leading-[1.6] text-mk-secondary">
                  No feature tiers, no per-seat pricing, no setup fee. Cancel whenever you like.
                </p>

                <div className="mt-7 flex items-baseline gap-2">
                  <span className="font-num text-[44px] font-semibold leading-none tracking-[-0.03em] text-white">
                    $299
                  </span>
                  <span className="text-[14.5px] text-mk-secondary">/ month</span>
                </div>

                <Button href="/sign-up" size="lg" className="mt-7 w-full">
                  Get started
                </Button>
                <p className="mt-3 text-center text-[12px] text-mk-muted">
                  Includes 250 calls a month. Higher volumes available at checkout.
                </p>
              </div>

              <Stagger
                as="ul"
                className="flex flex-col gap-3 md:border-l md:border-mk-line md:pl-10"
              >
                {INCLUDED.map((item) => (
                  <StaggerItem as="li" key={item} className="flex gap-2.5">
                    <Check />
                    <span className="text-[14px] leading-[1.5] text-mk-secondary">{item}</span>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
