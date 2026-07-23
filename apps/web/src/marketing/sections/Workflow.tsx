import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

const STEPS = [
  {
    title: 'A customer calls',
    detail: 'A homeowner dials your number. It is 2 AM and the ceiling is dripping.',
    at: '0:00',
  },
  {
    title: 'The AI answers',
    detail: 'Picked up on the first ring, in your company’s name, with your greeting.',
    at: '0:00.4',
  },
  {
    title: 'The lead is qualified',
    detail: 'Homeowner, address, roof age, urgency, and whether you cover the area.',
    at: '1:12',
  },
  {
    title: 'The appointment is booked',
    detail: 'A real slot on your real calendar, held before the caller hangs up.',
    at: '2:04',
  },
  {
    title: 'Your crew is notified',
    detail: 'Push, SMS and email — with the transcript and the summary attached.',
    at: '2:05',
  },
] as const;

function Step({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <li className="relative flex-1 pl-10 md:pl-0 md:pt-14">
      <span
        aria-hidden="true"
        className="absolute left-[11px] top-[7px] h-1.5 w-1.5 rounded-full bg-white/40 ring-[6px] ring-black md:left-0 md:top-[calc(3.5rem-3px)]"
      />
      <div className="max-w-[34ch] md:pr-10">
        <span className="font-num text-[11.5px] tabular-nums text-mk-muted">{step.at}</span>
        <h3 className="mt-3.5 min-h-[2.56em] text-[17px] font-medium leading-[1.28] tracking-[-0.015em] text-white">
          {step.title}
        </h3>
        <p className="mt-3.5 text-[14.5px] leading-[1.65] text-mk-secondary">{step.detail}</p>
      </div>
    </li>
  );
}

export function Workflow() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-[72px] sm:py-28">
      <Container>
        <Reveal>
          <h2 className="max-w-[20ch] text-balance text-[clamp(1.75rem,4.2vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            One call, start to finish, without you.
          </h2>
          <p className="mt-5 max-w-[58ch] text-pretty text-[15px] leading-[1.65] text-mk-secondary sm:text-[16.5px]">
            The same five things happen on every call, at three in the morning as reliably as at
            three in the afternoon. You find out when it is already handled.
          </p>
        </Reveal>

        <div className="relative mt-16 sm:mt-20">
          <span
            aria-hidden="true"
            className="absolute left-[14px] top-2 h-[calc(100%-1rem)] w-px bg-mk-line md:left-0 md:top-[3.5rem] md:h-px md:w-full"
          />

          <ol className="flex flex-col gap-12 md:flex-row md:gap-0">
            {STEPS.map((step) => (
              <Step key={step.title} step={step} />
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
