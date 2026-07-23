import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { TrustedBy } from './sections/TrustedBy';
import { Footer } from './sections/Footer';

/**
 * Below-the-fold sections load as one deferred chunk.
 *
 * Each `lazy` call points at the same module, so all of them cost a single
 * request — the module registry dedupes it — while the hero still ships in the
 * initial bundle.
 */
function deferred<K extends keyof typeof import('./sections/deferred')>(name: K) {
  return lazy(async () => {
    const module = await import('./sections/deferred');
    return { default: module[name] as ComponentType<Record<string, never>> };
  });
}

const Showcase = lazy(async () => ({ default: (await import('./sections/Showcase')).Showcase }));
const HowItWorks = deferred('HowItWorks');
const Metrics = deferred('Metrics');
const Intelligence = deferred('Intelligence');
const Testimonials = deferred('Testimonials');
const Pricing = deferred('Pricing');
const Faq = deferred('Faq');

const FinalCta = lazy(async () => {
  const module = await import('./sections/deferred');
  return { default: module.FinalCta };
});

/**
 * Reserved space for a section that has not arrived yet.
 *
 * Suspense fallbacks are the classic source of layout shift on a page like
 * this: an empty fallback collapses to nothing, then the real section pushes
 * everything down. Holding an approximate height means the scrollbar never
 * jumps.
 */
function Reserved({ height = '40rem' }: { height?: string }) {
  return <div aria-hidden="true" style={{ minHeight: height }} />;
}

const DESCRIPTION =
  'RoofersLabs is an AI receptionist for roofing companies. It answers every call 24/7, qualifies the homeowner, books the job, and transfers real emergencies to your crew.';

/**
 * Structured data. Worth the twenty lines: it is what turns a search result
 * into a rich one, and the page has no other machine-readable description of
 * what the product is or what it costs.
 */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RoofersLabs',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  offers: [
    { '@type': 'Offer', name: 'Starter', price: '299', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Professional', price: '599', priceCurrency: 'USD' },
  ],
};

/**
 * The marketing site.
 *
 * Every section enters differently, and every product visual on the page is
 * rendered from real components rather than an image. One near-black surface,
 * one accent; hierarchy is carried by type scale and space.
 */
export function MarketingPage() {
  const { isSignedIn } = useAuth();

  // The application is a light UI; only this route flips the document to black.
  // Doing it on <html> rather than a wrapper means overscroll and the browser's
  // own chrome match the page instead of flashing white at the edges.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.surface = 'void';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeColor?.getAttribute('content') ?? null;
    themeColor?.setAttribute('content', '#000000');

    return () => {
      delete root.dataset.surface;
      if (previousTheme) themeColor?.setAttribute('content', previousTheme);
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'RoofersLabs — The AI receptionist for roofing companies';

    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') ?? null;
    description?.setAttribute('content', DESCRIPTION);

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(STRUCTURED_DATA);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
      if (previousDescription) description?.setAttribute('content', previousDescription);
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-void text-ink">
      <a
        href="#main"
        className="pressable sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <Nav signedIn={Boolean(isSignedIn)} />

      <main id="main">
        <Hero signedIn={Boolean(isSignedIn)} />
        <TrustedBy />

        <Suspense fallback={<Reserved height="48rem" />}>
          <Showcase />
        </Suspense>

        <Suspense fallback={<Reserved height="36rem" />}>
          <HowItWorks />
          <Metrics />
          <Intelligence />
          <Testimonials />
          <Pricing />
          <Faq />
          <FinalCta signedIn={Boolean(isSignedIn)} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
