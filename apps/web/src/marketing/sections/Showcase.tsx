import { Container } from '../components/Container';
import { Reveal, Stagger, StaggerItem } from '../components/Reveal';

const CAPABILITIES = [
  {
    label: 'Answer',
    title: 'Every call is picked up instantly',
    detail:
      'RoofersLabs answers in your company’s name, follows your greeting, and stays available after hours.',
  },
  {
    label: 'Qualify',
    title: 'The right questions, every time',
    detail:
      'Caller details, address, roof age, job type, urgency, and service-area fit are captured consistently.',
  },
  {
    label: 'Book',
    title: 'Qualified leads become appointments',
    detail:
      'Available slots are offered during the call, then written back to your calendar before the caller hangs up.',
  },
  {
    label: 'Notify',
    title: 'Your team gets the full context',
    detail:
      'Transcripts, recordings, summaries, and emergency alerts reach the people who need to respond.',
  },
] as const;

const SIGNALS = [
  ['First ring', 'AI answer'],
  ['Lead score', 'Qualified'],
  ['Calendar', 'Booked'],
  ['Crew alert', 'Sent'],
] as const;

export function Showcase() {
  return (
    <section id="product" className="scroll-mt-24 py-[72px] sm:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <Reveal>
            <h2 className="max-w-[18ch] text-balance text-[clamp(1.75rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
              The front office, running itself.
            </h2>
            <p className="mt-5 max-w-[48ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:text-[16.5px]">
              Every call becomes a qualified record: who called, what they need, when they are
              booked, and who on your team needs to know.
            </p>

            <dl className="mt-10 grid max-w-[420px] grid-cols-2 border-y border-mk-line sm:mt-12">
              {SIGNALS.map(([label, value]) => (
                <div
                  key={label}
                  className="border-b border-mk-line py-5 odd:border-r odd:pr-5 even:pl-5 [&:nth-last-child(-n+2)]:border-b-0"
                >
                  <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-mk-muted">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-[15px] font-medium tracking-[-0.015em] text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Stagger
            as="div"
            delay={0.08}
            className="grid grid-cols-1 gap-px overflow-hidden border border-mk-line bg-mk-line md:grid-cols-2"
          >
            {CAPABILITIES.map((item) => (
              <StaggerItem key={item.label} className="bg-black p-5 sm:p-7">
                <span className="font-num text-[11px] font-medium uppercase tracking-[0.08em] text-mk-muted">
                  {item.label}
                </span>
                <h3 className="mt-5 text-[18px] font-medium leading-[1.25] tracking-[-0.02em] text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-[14.5px] leading-[1.65] text-mk-secondary">{item.detail}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Container>
    </section>
  );
}
