import { Link, useLocation } from 'react-router-dom';
import { LogoMark } from '@/components/Brand';
import { Container } from '../components/Container';
import { MARKETING_ROUTES, sectionHref } from '../routes';

/** Where the product is explained. Fragments, resolved against the home page. */
const SECTION_LINKS = [
  { fragment: '#product', label: 'Product' },
  { fragment: '#pricing', label: 'Pricing' },
] as const;

/** The legal and trust pages. Real routes, so these are router links. */
const PAGE_LINKS = [
  { to: MARKETING_ROUTES.terms, label: 'Terms' },
  { to: MARKETING_ROUTES.privacy, label: 'Privacy' },
  { to: MARKETING_ROUTES.refunds, label: 'Refunds' },
  { to: MARKETING_ROUTES.contact, label: 'Contact' },
] as const;

const LINK_CLASS =
  'text-[13px] text-white opacity-70 transition-opacity duration-200 ease-smooth hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black';

/**
 * The quiet bar that concludes every page: the copyright on one side, the
 * links on the other.
 *
 * Six links rather than three now that the legal pages exist, which is more
 * than fits on one phone row — so they wrap into a centred block on mobile and
 * settle onto a single row from `sm` up. The bullet separators the three-link
 * version used are gone with them: a bullet between wrapped rows lands in the
 * wrong place, and at six links the row reads fine on spacing alone.
 *
 * Contact was a `mailto:` and is now a page. The address is still on it.
 */
export function Footer() {
  const { pathname } = useLocation();

  return (
    <footer className="border-t border-mk-line bg-black py-6 sm:py-7">
      <Container>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between sm:gap-6">
          <p className="flex items-center gap-2.5 text-[13px] text-white/45">
            <LogoMark className="h-[10px] text-white/70" />
            &copy; 2026 rooferslabs
          </p>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 sm:justify-end sm:gap-x-6"
          >
            {SECTION_LINKS.map((link) => (
              <a
                key={link.fragment}
                href={sectionHref(link.fragment, pathname)}
                className={LINK_CLASS}
              >
                {link.label}
              </a>
            ))}

            {PAGE_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
