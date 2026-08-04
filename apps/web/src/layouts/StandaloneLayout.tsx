import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/auth/stages';
import { Logo } from '@/components/Brand';

/**
 * The shell for authenticated pages that sit outside the sidebar: onboarding,
 * the payment wall, billing, and the not-found page.
 *
 * It reuses the application header's own measurements — 64px tall, hairline
 * bottom border, translucent blur — so stepping out of the sidebar never feels
 * like stepping into a different product.
 */
export function StandaloneLayout({
  children,
  action,
  width = 'narrow',
  brandLinksHome = false,
}: {
  children: ReactNode;
  /** Trailing header slot, e.g. Clerk's <UserButton />. */
  action?: ReactNode;
  width?: 'narrow' | 'wide';
  /** Onboarding deliberately traps the user; the public-facing pages do not. */
  brandLinksHome?: boolean;
}) {
  const brand = (
    <>
      <Logo size="md" className="text-brand-950" />
    </>
  );

  return (
    <div className="min-h-screen bg-base">
      <header className="sticky top-0 z-20 border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] backdrop-blur">
        <div
          className={cn(
            'mx-auto flex h-16 items-center justify-between gap-4 px-6',
            width === 'wide' ? 'max-w-shell' : 'max-w-narrow',
          )}
        >
          {brandLinksHome ? (
            <Link
              to={ROUTES.marketing}
              className="focus-ring flex items-center gap-2.5"
              aria-label="rooferslabs home"
            >
              {brand}
            </Link>
          ) : (
            <span className="flex items-center gap-2.5">{brand}</span>
          )}
          {action}
        </div>
      </header>

      <main className={cn('mx-auto px-6 py-12', width === 'wide' ? 'max-w-shell' : 'max-w-narrow')}>
        {children}
      </main>
    </div>
  );
}
