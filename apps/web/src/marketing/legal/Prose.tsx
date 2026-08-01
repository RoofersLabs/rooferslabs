import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Shared by every link in a legal document, so the three cannot drift. */
const LINK =
  'rounded-xs text-mk-accent-fg underline-offset-4 transition-opacity duration-200 ease-smooth hover:underline hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black';

/**
 * The typographic kit the legal pages are built from.
 *
 * These exist so the four documents cannot drift into four slightly different
 * readings of the same scale, and so the measure is stated once. Everything
 * here uses the marketing palette — `mk-secondary` at 10:1 on black for running
 * copy, white for headings — rather than a second set of greys invented for
 * legal text.
 *
 * The one rule worth stating: running copy never goes wider than about 68
 * characters. That is what a long document needs to stay readable, and it is
 * narrower than the 1280px shell the rest of the site uses — a legal page is
 * the one place on this site where the container is the wrong measure.
 */

/** A numbered top-level clause. `id` gives it an anchor worth linking to. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 border-t border-mk-line pt-10 first:border-0 first:pt-0"
    >
      <h2 className="text-[22px] font-semibold leading-[1.25] tracking-[-0.02em] text-white sm:text-[25px]">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** A heading inside a clause, for the documents that need a second level. */
export function Subheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 text-[16px] font-semibold tracking-[-0.01em] text-white/90">{children}</h3>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-[15.5px] leading-[1.75] text-mk-secondary', className)}>{children}</p>
  );
}

/**
 * A bulleted list.
 *
 * The marker is a drawn dot rather than `list-disc`, because the browser's own
 * marker sits on the text baseline and this one sits on the first line's
 * optical centre — the difference is visible when an item runs to three lines.
 */
export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5">{children}</ul>;
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[15.5px] leading-[1.75] text-mk-secondary">
      <span aria-hidden className="mt-[0.72em] h-[3px] w-[3px] shrink-0 rounded-full bg-white/35" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Emphasis inside running copy, at the weight the marketing site uses. */
export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-white/90">{children}</strong>;
}

/** A mailto link, styled as the site styles its links. */
export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className={LINK}>
      {email}
    </a>
  );
}

/**
 * A link from one legal page to another.
 *
 * A router `Link`, not an anchor: these documents cross-reference each other,
 * and a plain `href` would tear the whole application down and rebuild it to
 * move between two pages that share a layout. The back button behaves the same
 * either way; the difference is a blank frame the reader does not need to see.
 */
export function InternalLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={LINK}>
      {children}
    </Link>
  );
}

/**
 * A pulled-out statement — used where a document says the one thing a reader
 * skimming it must not miss, such as who actually takes the payment.
 */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-mk-line bg-mk-card p-5">
      <p className="text-[15px] leading-[1.7] text-white/85">{children}</p>
    </div>
  );
}
