import { Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { CheckIcon } from '../components/icons';
import { LiveReceptionist } from '../product/LiveReceptionist';

const FEATURES = [
  'Natural conversations',
  'Lead qualification',
  'Appointment scheduling',
  'CRM synchronization',
  'Emergency call routing',
  'Knowledge base responses',
];

/**
 * The product section: a live AI receptionist call, looping.
 *
 * The old tabbed console showed the system's records; this shows the system
 * working. One column of copy, one column of conversation — the animation is
 * the argument, and a visitor should understand the product from watching a
 * single loop without reading a paragraph.
 */
export function Showcase() {
  return (
    <Section id="showcase">
      <Shell>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:gap-20">
          <div>
            <Reveal variant="fade">
              <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-white/[0.025] px-3 py-1 text-xs text-ink-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                AI Receptionist
              </span>
            </Reveal>

            <Reveal variant="up" index={1}>
              <h2 className="mt-6 text-headline font-medium">
                A receptionist that
                <br className="hidden sm:block" /> sounds human.
              </h2>
            </Reveal>

            <Reveal variant="up" index={2}>
              <p className="mt-6 max-w-prose text-lead text-ink-secondary">
                RoofersLabs answers every incoming call, understands the homeowner, qualifies the
                lead, books the appointment, and keeps your CRM current — following your company’s
                call flow automatically.
              </p>
            </Reveal>

            <Reveal variant="up" index={3}>
              <ul className="mt-9 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm text-ink-secondary"
                  >
                    <CheckIcon width={15} height={15} className="shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal variant="fade" index={4}>
              <a
                href="#resources"
                className="mt-9 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-150 ease-out hover:text-accent-hover"
              >
                Learn how it handles your calls
                <span aria-hidden="true">→</span>
              </a>
            </Reveal>
          </div>

          {/* The demo enters once with a scale reveal; from then on all motion
              is the call itself. */}
          <Reveal variant="scale" index={2}>
            <LiveReceptionist />
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
}
