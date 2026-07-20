import { Accordion } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { Reveal } from '../components/Reveal';

export const FAQS = [
  {
    q: 'Will homeowners know they’re talking to an AI?',
    a: 'Most don’t. The voice is natural, it pauses and responds like a person, and it answers in your company’s name. If a caller asks directly, it tells them the truth — and if they want a human, it takes a message and pages your team straight away.',
  },
  {
    q: 'Do I have to change my phone number?',
    a: 'No. Keep the number on your trucks, yard signs and Google listing. You simply forward that line to RoofersLabs, and you can turn forwarding off whenever you want.',
  },
  {
    q: 'What happens with emergency calls, like an active leak?',
    a: 'Emergencies are detected during the conversation — active leaks, storm damage, anything structural. The call is flagged, your on-call crew is notified by push and SMS within seconds, and the lead is pushed to the top of your dashboard.',
  },
  {
    q: 'Does it know roofing, or is it a generic answering service?',
    a: 'It’s trained specifically on roofing: shingle and metal systems, tear-offs, decking, underlayment, hail and wind damage, insurance claims and inspection scheduling. You then teach it your own service area, materials and pricing rules.',
  },
  {
    q: 'Can it book straight into our calendar?',
    a: 'Yes. It reads your real availability from Google Calendar or Outlook and only offers slots you actually want filled — including travel-time rules so you’re not sending a crew across the county for back-to-back inspections.',
  },
  {
    q: 'What if it can’t answer something?',
    a: 'It doesn’t guess. When a question falls outside what it knows, it takes the details, tells the caller when someone will get back to them, and notifies your team with everything captured so far.',
  },
  {
    q: 'How long does setup actually take?',
    a: 'Forwarding your line takes about five minutes. Training the AI on your business takes roughly fifteen. Most companies are answering live calls the same afternoon they sign up.',
  },
  {
    q: 'What happens during a storm when call volume spikes?',
    a: 'It answers every call at once — there is no queue and no busy signal. Storm days are when the system earns its keep, because that’s exactly when a human front desk gets overwhelmed.',
  },
];

export function Faq() {
  return (
    <Section id="faq" glow="left">
      <Container size="narrow">
        <SectionHeading eyebrow="FAQ" title="The questions roofers actually ask." />
        <Reveal className="mt-12">
          <Accordion.Root type="single" collapsible className="flex flex-col gap-3">
            {FAQS.map((item, i) => (
              <Accordion.Item
                key={item.q}
                value={`item-${i}`}
                className="overflow-hidden rounded-xl border border-mkt-line-subtle bg-mkt-surface transition-colors duration-200 data-[state=open]:border-mkt-accent-border"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="mkt-focus-ring group flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5">
                    <span className="text-[0.9375rem] font-medium text-mkt-ink">{item.q}</span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-mkt-ink-faint transition-transform duration-300 group-data-[state=open]:rotate-180"
                      aria-hidden
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-[mkt-acc-up_220ms_ease] data-[state=open]:animate-[mkt-acc-down_220ms_ease]">
                  <p className="px-5 pb-5 text-[0.9375rem] leading-relaxed text-mkt-ink-muted sm:px-6 sm:pb-6">
                    {item.a}
                  </p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </Reveal>
      </Container>
    </Section>
  );
}
