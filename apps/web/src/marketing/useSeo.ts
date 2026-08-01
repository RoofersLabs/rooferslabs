import { useEffect } from 'react';

const SITE_ORIGIN = 'https://rooferslabs.com';
const SITE_NAME = 'rooferslabs';

export interface SeoInput {
  /** Becomes `<title>`; the site name is appended. */
  title: string;
  description: string;
  /** Path only, e.g. `/terms`. Resolved against the canonical origin. */
  path: string;
}

/**
 * Per-route document metadata: title, description, canonical, Open Graph.
 *
 * A word on what this can and cannot do. The site is a client-rendered SPA
 * served as one static `index.html`, so these tags are written after the
 * bundle executes. Anything that reads the raw HTML without running scripts —
 * some crawlers, some link unfurlers — sees the defaults baked into
 * `index.html` instead. That is a real limit, and the reason these pages are
 * worth having is unaffected by it: a payment reviewer, a customer following a
 * footer link, and Googlebot (which does execute JavaScript) all see the right
 * thing. Fixing it properly means prerendering, which is a build-pipeline
 * change rather than a page.
 *
 * Every tag is restored on unmount rather than left behind. Without that, a
 * visitor going /terms → / would keep the Terms description in the head for
 * the rest of the session, and the next share of the home page would carry it.
 */
export function useSeo({ title, description, path }: SeoInput): void {
  useEffect(() => {
    const fullTitle = `${title} · ${SITE_NAME}`;
    const url = `${SITE_ORIGIN}${path}`;

    const restore: Array<() => void> = [];

    const previousTitle = document.title;
    document.title = fullTitle;
    restore.push(() => {
      document.title = previousTitle;
    });

    restore.push(setMeta('name', 'description', description));
    restore.push(setMeta('property', 'og:title', title));
    restore.push(setMeta('property', 'og:description', description));
    restore.push(setMeta('property', 'og:url', url));
    restore.push(setMeta('name', 'twitter:title', title));
    restore.push(setMeta('name', 'twitter:description', description));
    restore.push(setCanonical(url));

    return () => {
      // Reverse order, so a tag this hook created is removed by the same call
      // that created it even if two of them touched the same element.
      for (const undo of restore.reverse()) undo();
    };
  }, [title, description, path]);
}

/**
 * Point a meta tag at a new value, returning the undo.
 *
 * Creates the tag when the document has none — the marketing `index.html`
 * ships `description`, `og:*` and `twitter:*`, but not every key used here —
 * and removes only what it created, so a tag that already existed is put back
 * to its old content rather than deleted.
 */
function setMeta(keyAttr: 'name' | 'property', key: string, value: string): () => void {
  const selector = `meta[${keyAttr}="${CSS.escape(key)}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (existing) {
    const previous = existing.getAttribute('content');
    existing.setAttribute('content', value);
    return () => {
      if (previous === null) existing.removeAttribute('content');
      else existing.setAttribute('content', previous);
    };
  }

  const created = document.createElement('meta');
  created.setAttribute(keyAttr, key);
  created.setAttribute('content', value);
  document.head.appendChild(created);
  return () => created.remove();
}

/** The canonical link, same create-or-update contract as {@link setMeta}. */
function setCanonical(url: string): () => void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (existing) {
    const previous = existing.href;
    existing.href = url;
    return () => {
      existing.href = previous;
    };
  }

  const created = document.createElement('link');
  created.rel = 'canonical';
  created.href = url;
  document.head.appendChild(created);
  return () => created.remove();
}
