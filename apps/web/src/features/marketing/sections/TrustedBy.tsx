import { Reveal } from '../components/Reveal';
import { Shell } from '../components/primitives';

/**
 * Logo marquee.
 *
 * ⚠️ PLACEHOLDER CONTENT — these are invented company names standing in for
 * real customer logos. Swap them (and delete this warning) before launch; do
 * not ship fabricated customer names publicly.
 *
 * They are set as wordmarks rather than images on purpose: no image requests,
 * no CLS, and they inherit the site's type so a half-finished logo wall still
 * looks deliberate.
 */
const COMPANIES = [
  'Summit Roofing Co.',
  'Ironclad Exteriors',
  'Northgate Roofing',
  'Bluepeak Contracting',
  'Halstead Roof & Siding',
  'Cardinal Exteriors',
  'Meridian Roofworks',
  'Stonebridge Roofing',
];

export function TrustedBy() {
  return (
    <section aria-label="Companies using RoofersLabs" className="border-y border-subtle py-14">
      <Shell>
        <Reveal variant="fade">
          <p className="text-center font-mono text-eyebrow uppercase text-ink-tertiary">
            Trusted by roofing companies across the country
          </p>
        </Reveal>
      </Shell>

      <div className="marquee-mask relative mt-9 overflow-hidden">
        {/* The track holds two identical copies and translates by exactly -50%,
            so the loop point is seamless at any width. `linear` is the only
            correct easing for constant motion. */}
        <div className="marquee-track flex w-max items-center gap-14 pr-14">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-14 pr-14" aria-hidden={copy === 1}>
              {COMPANIES.map((name) => (
                <span
                  key={name}
                  className="whitespace-nowrap text-[0.9375rem] font-medium tracking-tight text-ink-tertiary transition-colors duration-300 ease-out hover:text-ink"
                >
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
