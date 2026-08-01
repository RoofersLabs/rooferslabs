import { useEffect, type ReactNode } from 'react';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';
import { MarketingHeader } from '../sections/MarketingHeader';
import { Footer } from '../sections/Footer';
import { useSeo } from '../useSeo';
import { LAST_UPDATED } from './content';

/**
 * The shell every legal and trust page is poured into.
 *
 * Same chrome as the marketing page — the pinned header, the same footer, the
 * same black canvas claimed on the document element — so arriving here from a
 * footer link never feels like leaving the site. What changes is the measure:
 * the marketing sections run to the 1280px shell because they are built from
 * cards and columns, and a legal document is one column of prose that becomes
 * unreadable at that width.
 *
 * `showLastUpdated` is off for the contact page, which is the one page here
 * that is not a dated document.
 */
export function LegalLayout({
  title,
  subtitle,
  seoDescription,
  path,
  showLastUpdated = true,
  children,
}: {
  title: string;
  subtitle: string;
  seoDescription: string;
  path: string;
  showLastUpdated?: boolean;
  children: ReactNode;
}) {
  useSeo({ title, description: seoDescription, path });

  // The application is a light operations tool; this is the dark editorial
  // canvas. Claimed for as long as the route is mounted, exactly as
  // MarketingPage does it, so overscroll and the browser's UI tint follow.
  useEffect(() => {
    document.documentElement.classList.add('marketing-surface');
    return () => document.documentElement.classList.remove('marketing-surface');
  }, []);

  // A legal page is almost always arrived at from a footer link at the bottom
  // of a long page. Without this the reader lands at whatever scroll offset
  // they left, which on a short document is past the heading.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="min-h-screen bg-mk-bg font-display text-white antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-mk-accent focus:px-4 focus:py-2 focus:text-[13.5px] focus:text-white"
      >
        Skip to content
      </a>

      <MarketingHeader />

      {/* The top padding clears the fixed header stack, which is taller than it
          looks because the announcement bar sits above the navigation. */}
      <main id="main" className="pt-32 pb-24 sm:pt-40 sm:pb-32">
        <Container>
          {/* `max-w-[46rem]` is roughly 68 characters at this size — the measure
              the whole page is built around, applied to the heading block as
              well as the prose so the title sits over its own column rather
              than over the shell. */}
          <div className="mx-auto max-w-[46rem]">
            <Reveal as="header">
              <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[52px]">
                {title}
              </h1>
              <p className="mt-5 text-[17px] leading-[1.6] text-mk-secondary sm:text-[18.5px]">
                {subtitle}
              </p>
              {showLastUpdated && (
                <p className="mt-7 text-[13px] uppercase tracking-[0.08em] text-mk-muted">
                  Last updated {LAST_UPDATED}
                </p>
              )}
            </Reveal>

            <Reveal className="mt-14 space-y-10 sm:mt-16" delay={0.06}>
              {children}
            </Reveal>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
