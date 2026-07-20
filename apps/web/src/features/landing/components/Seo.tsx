import { useEffect } from 'react';
import { FAQS } from '../sections/Faq';

const SITE = 'https://rooferslabs.com';
const TITLE = 'RoofersLabs — AI Receptionist for Roofing Companies | Never Miss a Lead';
const DESCRIPTION =
  'RoofersLabs answers your roofing company’s calls 24/7, qualifies homeowners, books inspections and syncs your CRM. Live in under 10 minutes. 14-day free trial, no credit card.';

/**
 * Document metadata + JSON-LD for the landing page.
 *
 * This is a Vite SPA with no SSR, so crawlers that don't execute JavaScript see
 * only the static tags in index.html — those carry the canonical title and
 * description. What's set here upgrades the page for JS-capable crawlers
 * (Google, Bing) and is reverted on unmount so the authenticated app doesn't
 * inherit marketing copy in the tab title.
 *
 * If organic search becomes a real acquisition channel, the durable fix is
 * prerendering this route at build time rather than extending this file.
 */
export function Seo() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = TITLE;

    const created: Element[] = [];

    const meta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute('content', content);
    };

    meta('name', 'description', DESCRIPTION);
    meta('property', 'og:type', 'website');
    meta('property', 'og:title', TITLE);
    meta('property', 'og:description', DESCRIPTION);
    meta('property', 'og:url', SITE);
    meta('property', 'og:site_name', 'RoofersLabs');
    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', TITLE);
    meta('name', 'twitter:description', DESCRIPTION);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
      created.push(canonical);
    }
    canonical.setAttribute('href', SITE);

    // FAQPage markup is generated from the same array the section renders, so
    // the structured data can never drift from what's actually on the page.
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'RoofersLabs',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: DESCRIPTION,
        url: SITE,
        offers: {
          '@type': 'Offer',
          price: '299',
          priceCurrency: 'USD',
          category: 'Subscription',
        },
        audience: {
          '@type': 'BusinessAudience',
          audienceType: 'Roofing contractors',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ]);
    document.head.appendChild(ld);
    created.push(ld);

    return () => {
      document.title = previousTitle;
      created.forEach((el) => el.remove());
    };
  }, []);

  return null;
}
