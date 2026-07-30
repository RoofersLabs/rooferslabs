import { useEffect, useState } from 'react';
import { Logo } from '@/components/Brand';
import { Button, buttonClass } from '@/components/ui/button';
import { EarlyAccessDialog } from './EarlyAccessDialog';
import { trackLaunchEvent } from './analytics';

const CONTACT_EMAIL = 'hello@rooferslabs.com';

/**
 * The only page an unauthorized visitor sees while the beta is private.
 *
 * Design intent: typography and whitespace carry the whole page. One column,
 * one accent, no gradient, no illustration, no animation beyond the standard
 * control transitions the design system already defines. The restraint is the
 * point — a launch page that tries hard reads as a placeholder, and this one
 * has to read as a company that is deliberately not open yet.
 *
 * Composed from the application's own primitives (Logo, Button, Modal, Input)
 * rather than bespoke markup, so it inherits the product's type scale, focus
 * rings, and both themes for free and cannot drift from the rest of the app.
 *
 * Deliberately renders no navigation, no sign-in affordance, and no link into
 * the application. The gate is enforced server-side regardless, but there is no
 * reason to advertise the doors to someone who cannot open them.
 */
export function LaunchPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    trackLaunchEvent('launch_page_viewed');
  }, []);

  return (
    <>
      <main className="flex min-h-screen flex-col bg-base px-6 py-10 sm:px-10">
        <header>
          <Logo size="md" className="text-ink" />
        </header>

        {/* Optically centred: `justify-center` on the remaining space, with the
            content capped at a comfortable measure rather than the viewport. */}
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-xl py-16">
            <p className="text-caption uppercase tracking-[0.12em] text-ink-faint">Private beta</p>

            <h1 className="mt-5 text-balance text-h1 font-semibold tracking-tight text-ink">
              AI receptionist for roofing companies
            </h1>

            <p className="mt-5 text-pretty text-body-lg leading-7 text-ink-muted">
              We&rsquo;re preparing for launch. Our team is currently onboarding our first
              customers, and public access will open soon.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => setDialogOpen(true)}>
                Request early access
              </Button>
              {/* An anchor, not a Button: this navigates rather than acts, and
                  Button renders a <button> with no `asChild` escape hatch.
                  `buttonClass` is exported precisely so a link can wear the
                  button's appearance without impersonating its semantics. */}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={buttonClass('secondary', 'lg', 'w-full sm:w-auto')}
              >
                Contact us
              </a>
            </div>
          </div>
        </div>

        <footer className="text-caption text-ink-faint">
          &copy; {new Date().getFullYear()} rooferslabs
        </footer>
      </main>

      <EarlyAccessDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
