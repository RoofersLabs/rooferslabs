import { Link } from 'react-router-dom';
import { Container } from '../components/Section';
import { Logo } from '../components/Logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '#features' },
      { label: 'How it works', to: '#how-it-works' },
      { label: 'Integrations', to: '#integrations' },
      { label: 'Pricing', to: '#pricing' },
      { label: 'Live demo', to: '#demo' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '#' },
      { label: 'Contact sales', to: 'mailto:sales@rooferslabs.com' },
      { label: 'Support', to: 'mailto:support@rooferslabs.com' },
      { label: 'Status', to: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', to: '#' },
      { label: 'Terms of service', to: '#' },
      { label: 'Call recording policy', to: '#' },
      { label: 'Security', to: '#' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-mkt-line-subtle bg-mkt-bg-subtle px-5 py-14 sm:px-6 sm:py-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Link
              to="/"
              className="mkt-focus-ring flex w-fit items-center gap-2.5 rounded-lg"
              aria-label="RoofersLabs home"
            >
              <Logo />
              <span className="text-[0.9375rem] font-semibold tracking-tight text-mkt-ink">
                RoofersLabs
              </span>
            </Link>
            <p className="max-w-xs text-[0.875rem] leading-relaxed text-mkt-ink-muted">
              The AI front office for roofing companies. Every call answered, every lead captured,
              every appointment booked — around the clock.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-[0.8125rem] font-semibold text-mkt-ink">{col.title}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink to={l.to}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-mkt-line-subtle pt-8 sm:flex-row sm:items-center">
          <p className="text-[0.8125rem] text-mkt-ink-muted">
            © {year} RoofersLabs. All rights reserved.
          </p>
          <p className="text-[0.8125rem] text-mkt-ink-muted">
            Built for roofing contractors in the USA.
          </p>
        </div>
      </Container>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: string }) {
  const cls =
    'mkt-focus-ring rounded text-[0.875rem] text-mkt-ink-muted transition-colors duration-200 hover:text-mkt-ink';
  const isExternal = to.startsWith('#') || to.startsWith('mailto:') || /^https?:/.test(to);

  return isExternal ? (
    <a href={to} className={cls}>
      {children}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}
