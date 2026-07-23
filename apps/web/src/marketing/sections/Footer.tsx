import { Container } from '../components/Container';

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: 'mailto:hello@rooferslabs.com', label: 'Contact' },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-mk-line bg-black py-10 sm:py-12">
      <Container>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <a
            href="/"
            className="text-[15px] font-semibold tracking-[-0.02em] text-white transition-opacity duration-200 ease-smooth hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            RoofersLabs
          </a>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 sm:justify-end">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13.5px] text-white/70 transition-colors duration-200 ease-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="mt-10 text-[12.5px] text-white/45">
          &copy; 2026 RoofersLabs. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
