import { Reveal } from '../components/Reveal';
import { Eyebrow, Section, Shell } from '../components/primitives';

/**
 * ⚠️ PLACEHOLDER TESTIMONIALS — invented people and companies. Replace with
 * real, attributed quotes before launch.
 *
 * Avatars are initials rather than photographs: a stock photo attached to a
 * customer quote is a lie with a face on it, and monograms read cleaner on
 * black anyway.
 */
const FEATURED = {
  quote:
    'We were losing four or five jobs a week to voicemail and never knew it. Now every call gets answered, and I see exactly what it said.',
  name: 'Dale Whitmore',
  role: 'Owner',
  company: 'Summit Roofing Co.',
};

const SUPPORTING = [
  {
    quote: 'Storm season used to mean two people on phones all day. This year it meant neither.',
    name: 'Renata Silva',
    role: 'Operations Manager',
    company: 'Ironclad Exteriors',
  },
  {
    quote: 'It books straight into our calendar. The crews noticed before the office did.',
    name: 'Curtis Nwosu',
    role: 'General Manager',
    company: 'Northgate Roofing',
  },
];

function Monogram({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('');

  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-subtle bg-white/[0.04] text-xs font-medium text-ink-secondary"
    >
      {initials}
    </span>
  );
}

export function Testimonials() {
  return (
    <Section className="border-t border-subtle">
      <Shell>
        <Reveal variant="fade">
          <Eyebrow>Customers</Eyebrow>
        </Reveal>

        {/* The featured quote is set at headline scale and enters through a
            blur — the softest reveal on the page, for the quietest section. */}
        <Reveal variant="blur" index={1}>
          <figure className="mt-10 max-w-4xl">
            <blockquote className="text-[clamp(1.5rem,3.2vw,2.5rem)] font-medium leading-[1.25] tracking-[-0.03em]">
              “{FEATURED.quote}”
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-3">
              <Monogram name={FEATURED.name} />
              <span className="text-sm">
                <span className="font-medium">{FEATURED.name}</span>
                <span className="text-ink-tertiary">
                  {' '}
                  · {FEATURED.role}, {FEATURED.company}
                </span>
              </span>
            </figcaption>
          </figure>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-subtle bg-white/[0.06] md:grid-cols-2">
          {SUPPORTING.map((item, index) => (
            <Reveal key={item.name} variant="up" index={index} className="bg-void p-7 md:p-8">
              <figure>
                <blockquote className="text-[1.0625rem] leading-relaxed text-ink-secondary">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Monogram name={item.name} />
                  <span className="text-sm">
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-xs text-ink-tertiary">
                      {item.role}, {item.company}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Shell>
    </Section>
  );
}
