import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';

/**
 * Monograms rather than brand logos: shipping third-party marks means shipping
 * ten more image requests and ten trademark usage questions. Set in the site's
 * own type, the rail stays consistent and costs nothing.
 */
const INTEGRATIONS = [
  { name: 'Twilio', category: 'Telephony', note: 'Your existing number, forwarded in minutes.' },
  { name: 'OpenAI', category: 'Models', note: 'The reasoning behind every call.' },
  { name: 'Google Calendar', category: 'Scheduling', note: 'Live crew availability, both ways.' },
  { name: 'ServiceTitan', category: 'Field service', note: 'Jobs and customers stay in sync.' },
  { name: 'JobNimbus', category: 'Roofing CRM', note: 'Leads land as contacts, not notes.' },
  { name: 'CompanyCam', category: 'Job photos', note: 'Call context attached to the project.' },
  { name: 'HubSpot', category: 'CRM', note: 'Every caller becomes a tracked deal.' },
  { name: 'Salesforce', category: 'CRM', note: 'Enterprise pipelines, no manual entry.' },
  { name: 'Stripe', category: 'Billing', note: 'Deposits collected on the call.' },
  { name: 'Clerk', category: 'Identity', note: 'SSO and roles for your whole office.' },
];

/**
 * A horizontal rail rather than another grid.
 *
 * Changing the reading direction is the point: after five stacked sections, a
 * sideways rail resets attention. Scrolling is native with snap points — no
 * custom drag logic to get wrong on a trackpad.
 */
export function Integrations() {
  return (
    <Section id="integrations" className="border-t border-subtle">
      <Shell>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Reveal variant="fade">
              <Eyebrow>Integrations</Eyebrow>
            </Reveal>
            <Reveal variant="up" index={1}>
              <h2 className="mt-5 text-headline font-medium">
                Fits the stack
                <span className="text-ink-tertiary"> you already run.</span>
              </h2>
            </Reveal>
          </div>
          <Reveal variant="fade" index={2}>
            <p className="font-mono text-xs text-ink-quaternary">Scroll →</p>
          </Reveal>
        </div>
      </Shell>

      <div className="rail-mask mt-14">
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:px-8">
          {INTEGRATIONS.map((integration, index) => (
            <Reveal
              key={integration.name}
              variant="up"
              // Only the first few stagger; anything further right is off
              // screen by the time the section reveals, so delaying it just
              // means it is already late when scrolled to.
              index={Math.min(index, 4)}
              className="w-[16.5rem] shrink-0 snap-start rounded-xl border border-subtle bg-surface-raised p-5 transition-[border-color,background-color,transform] duration-300 ease-out hover:-translate-y-1 hover:border-strong hover:bg-surface-hover motion-reduce:hover:translate-y-0"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-subtle bg-white/[0.03] text-sm font-semibold tracking-tight"
                aria-hidden="true"
              >
                {integration.name.slice(0, 2)}
              </span>
              <h3 className="mt-5 text-[0.9375rem] font-medium">{integration.name}</h3>
              <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-quaternary">
                {integration.category}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{integration.note}</p>
            </Reveal>
          ))}
          <div className="w-2 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </Section>
  );
}
