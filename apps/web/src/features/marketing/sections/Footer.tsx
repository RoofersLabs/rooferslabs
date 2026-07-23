import { Link } from 'react-router-dom';
import { Logomark } from '../components/icons';
import { Shell } from '../components/primitives';

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Capabilities', href: '#product' },
      { label: 'Live demo', href: '#showcase' },
      { label: 'Integrations', href: '#integrations' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: 'mailto:hello@rooferslabs.com' },
      { label: 'Careers', href: 'mailto:careers@rooferslabs.com' },
      { label: 'Contact sales', href: 'mailto:sales@rooferslabs.com' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'FAQ', href: '#resources' },
      { label: 'How it works', href: '#solutions' },
      { label: 'Support', href: 'mailto:support@rooferslabs.com' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Call recording policy', href: '/recording-policy' },
    ],
  },
];

/**
 * Footer.
 *
 * ⚠️ `/privacy`, `/terms` and `/recording-policy` are not routed yet — they
 * currently resolve to the 404 page. Add them before launch; a call-recording
 * product without a published recording policy is a compliance problem in
 * two-party consent states.
 */
export function Footer() {
  return (
    <footer id="company" className="border-t border-subtle py-16">
      <Shell>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <Link
              to="/"
              className="pressable inline-flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight"
            >
              <Logomark className="text-ink" />
              RoofersLabs
            </Link>
            <p className="mt-4 max-w-[16rem] text-sm leading-relaxed text-ink-tertiary">
              The AI front office for roofing companies.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-mono text-[0.6875rem] uppercase tracking-wider text-ink-quaternary">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link
                        to={link.href}
                        className="text-sm text-ink-tertiary transition-colors duration-150 ease-out hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-ink-tertiary transition-colors duration-150 ease-out hover:text-ink"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule mt-14" />

        <div className="mt-6 flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-quaternary">
            © {new Date().getFullYear()} RoofersLabs. All rights reserved.
          </p>
          <ul className="flex items-center gap-5">
            {[
              { label: 'LinkedIn', href: 'https://www.linkedin.com/company/rooferslabs' },
              { label: 'X', href: 'https://x.com/rooferslabs' },
            ].map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-ink-tertiary transition-colors duration-150 ease-out hover:text-ink"
                >
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    </footer>
  );
}
