import { Fragment } from 'react';
import { Container } from '../components/Container';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
  { href: 'mailto:hello@rooferslabs.com', label: 'Contact' },
] as const;

/**
 * A single quiet bar that concludes the page: the copyright on one side, three
 * essential links on the other. It sits on one row from the small breakpoint up
 * and folds into two centred rows on mobile.
 */
export function Footer() {
  return (
    <footer className="border-t border-mk-line bg-black py-6 sm:py-7">
      <Container>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-6">
          <p className="text-[13px] text-white/45">&copy; 2026 RoofersLabs</p>

          <nav
            aria-label="Footer"
            className="flex items-center justify-center gap-x-2.5 sm:justify-end sm:gap-x-6"
          >
            {LINKS.map((link, index) => (
              <Fragment key={link.href}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-white/25 sm:hidden">
                    &bull;
                  </span>
                )}
                <a
                  href={link.href}
                  className="text-[13px] text-white opacity-70 transition-opacity duration-200 ease-smooth hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
                >
                  {link.label}
                </a>
              </Fragment>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
