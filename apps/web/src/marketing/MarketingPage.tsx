import { useEffect } from 'react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Workflow } from './sections/Workflow';
import { Showcase } from './sections/Showcase';
import { Pricing } from './sections/Pricing';
import { FinalCta } from './sections/FinalCta';
import { Footer } from './sections/Footer';

/**
 * The public marketing site.
 *
 * The application is a light-mode operations tool and this is a dark editorial
 * canvas, so the surface is claimed on the document element for as long as this
 * route is mounted — that keeps overscroll, the browser's own UI tint, and the
 * area beneath a short page black rather than leaking the application's gray.
 */
export function MarketingPage() {
  useEffect(() => {
    document.documentElement.classList.add('marketing-surface');
    return () => document.documentElement.classList.remove('marketing-surface');
  }, []);

  return (
    <div className="min-h-screen bg-mk-bg font-display text-white antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mk-accent focus:px-4 focus:py-2 focus:text-[13.5px] focus:text-white"
      >
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <Hero />
        <Workflow />
        <Showcase />
        <Pricing />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
