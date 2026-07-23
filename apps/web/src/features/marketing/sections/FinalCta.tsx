import { Cta, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';

/**
 * The close.
 *
 * One sentence, two buttons, nothing else. Everything that could be said has
 * been said above — this section's only job is to be unmissable.
 */
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <Section className="relative overflow-hidden border-t border-subtle">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background:
            'radial-gradient(50% 100% at 50% 100%, rgba(37,99,235,0.14), transparent 70%)',
        }}
      />

      <Shell className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal variant="blur" as="h2" className="text-display font-medium">
            The next call is
            <br />
            already ringing.
          </Reveal>

          <Reveal variant="up" index={2}>
            <p className="mx-auto mt-7 max-w-lg text-lead text-ink-secondary">
              Put RoofersLabs on your line today and stop finding out about jobs from voicemail.
            </p>
          </Reveal>

          <Reveal variant="up" index={3}>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Cta to={signedIn ? '/dashboard' : '/sign-up'}>
                {signedIn ? 'Go to dashboard' : 'Start free trial'}
              </Cta>
              <Cta to="mailto:sales@rooferslabs.com" variant="secondary">
                Book a walkthrough
              </Cta>
            </div>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
}
