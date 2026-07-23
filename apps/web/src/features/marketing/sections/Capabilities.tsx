import type { ComponentType, SVGProps } from 'react';
import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import {
  AnalyticsIcon,
  CalendarIcon,
  KnowledgeIcon,
  LeadIcon,
  PhoneIcon,
  UrgentIcon,
} from '../components/icons';

type Capability = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
  /** A concrete, checkable detail. Specifics persuade; adjectives do not. */
  detail: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: PhoneIcon,
    title: 'Answer calls',
    body: 'Picks up on the first ring, every hour of every day, in your company’s voice.',
    detail: '1.2s average answer time',
  },
  {
    icon: CalendarIcon,
    title: 'Book appointments',
    body: 'Reads live crew availability and writes the job straight into the calendar.',
    detail: 'Confirmed by text before hang-up',
  },
  {
    icon: LeadIcon,
    title: 'Capture leads',
    body: 'Name, address, roof age, insurance status — captured while the homeowner is still talking.',
    detail: 'Synced to your CRM in seconds',
  },
  {
    icon: UrgentIcon,
    title: 'Transfer emergencies',
    body: 'Active leaks and storm damage get a human on the line instead of a booking slot.',
    detail: 'Escalation rules you set',
  },
  {
    icon: KnowledgeIcon,
    title: 'Know your business',
    body: 'Service area, pricing, warranty and claims policy — answered from your own documents.',
    detail: 'Every answer cites its source',
  },
  {
    icon: AnalyticsIcon,
    title: 'Report on all of it',
    body: 'Where calls come from, which convert, and what a missed hour actually costs you.',
    detail: 'Weekly summary in your inbox',
  },
];

/**
 * Capability grid.
 *
 * Cards enter in a staggered fade-up so the grid resolves row by row. The next
 * section reveals with a mask instead — no two adjacent sections share an
 * entrance.
 */
export function Capabilities() {
  return (
    <Section id="product">
      <Shell>
        <div className="max-w-3xl">
          <Reveal variant="fade">
            <Eyebrow>Capabilities</Eyebrow>
          </Reveal>
          <Reveal variant="up" index={1}>
            <h2 className="mt-5 text-headline font-medium">
              Everything a front desk does.
              <br className="hidden sm:block" />{' '}
              <span className="text-ink-tertiary">None of what goes wrong.</span>
            </h2>
          </Reveal>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-subtle bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability, index) => {
            const Glyph = capability.icon;
            return (
              <Reveal
                key={capability.title}
                variant="up"
                // Stagger by column position so each row cascades left to
                // right rather than the whole grid arriving at once.
                index={index % 3}
                className="group bg-void p-6 transition-colors duration-300 ease-out hover:bg-surface md:p-8"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle bg-white/[0.03] text-ink-secondary transition-colors duration-300 ease-out group-hover:border-accent/40 group-hover:text-accent">
                  <Glyph width={17} height={17} />
                </span>
                <h3 className="mt-5 text-[0.9375rem] font-medium">{capability.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {capability.body}
                </p>
                <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-quaternary">
                  {capability.detail}
                </p>
              </Reveal>
            );
          })}
        </div>
      </Shell>
    </Section>
  );
}
