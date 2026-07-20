import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Database,
  Headphones,
  PhoneCall,
} from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { RevealGroup, RevealItem } from '../components/Reveal';
import { MktCard, IconTile } from '../components/Card';

const FEATURES = [
  {
    icon: PhoneCall,
    title: 'AI receptionist',
    body: 'Answers in your company’s name with a natural voice, handles the whole conversation, and knows when to hand off to a human.',
  },
  {
    icon: CalendarClock,
    title: 'Appointment booking',
    body: 'Reads your real availability and books inspections and estimates directly into the calendar your crew already runs on.',
  },
  {
    icon: Database,
    title: 'CRM sync',
    body: 'Contacts, job details, transcripts and outcomes flow straight into your system. Nobody retypes a phone number again.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge base',
    body: 'Teach it your service area, materials, warranties and pricing rules so the answers callers get are the ones you’d give.',
  },
  {
    icon: Headphones,
    title: 'Call recording & transcripts',
    body: 'Every call recorded, transcribed and summarised — for training your team, settling disputes, and insurance documentation.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'Booking rate, response time, call volume by hour, and which marketing actually put the phone in someone’s hand.',
  },
];

export function FeatureGrid() {
  return (
    <Section id="features" tone="subtle" bordered>
      <Container>
        <SectionHeading
          eyebrow="Features"
          title="A complete front office, not just a voice."
          lede="Answering the phone is where it starts. What makes it pay is everything that happens after the call ends."
        />
        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <MktCard interactive className="h-full p-6 sm:p-7">
                <IconTile>
                  <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                </IconTile>
                <h3 className="mt-5 text-base font-semibold text-mkt-ink">{title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-mkt-ink-muted">{body}</p>
              </MktCard>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Section>
  );
}
