import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every section is measured against the same 1200px shell and the same gutter.
 * Nothing on the page opts out — consistent edges are most of what reads as
 * "designed".
 */
export function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-shell px-6 md:px-8', className)}>{children}</div>;
}

/**
 * Vertical rhythm lives here rather than being re-decided per section. Sections
 * get generous breathing room; the page is meant to feel unhurried.
 */
export function Section({
  children,
  className,
  id,
  label,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Accessible name for the landmark, when the visible heading is not enough. */
  label?: string;
}) {
  return (
    <section
      id={id}
      aria-label={label}
      className={cn('relative py-24 md:py-32 lg:py-40', className)}
    >
      {children}
    </section>
  );
}

/** Small monospaced label that sits above a headline. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'font-mono text-eyebrow font-medium uppercase text-ink-tertiary',
        className,
      )}
    >
      {children}
    </p>
  );
}

type CtaProps = {
  children: ReactNode;
  to: string;
  variant?: 'primary' | 'secondary';
  /** `sm` is the navigation bar; `md` is everything in page content. */
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * The only two button styles on the site, in two sizes.
 *
 * Both scale to 0.97 on press. It is the cheapest way to make an interface feel
 * like it is listening, and its absence is felt even when its presence is not
 * noticed. Radii stay at 8px — the oversized pill reads as consumer app, not as
 * enterprise software.
 */
export function Cta({ children, to, variant = 'primary', size = 'md', className }: CtaProps) {
  const base = cn(
    'pressable inline-flex items-center justify-center gap-2 rounded-lg font-medium',
    size === 'sm' ? 'h-9 px-3.5 text-[0.8125rem]' : 'h-11 px-5 text-[0.9375rem]',
  );

  const styles =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-hover active:bg-accent-press'
      : 'border border-subtle bg-white/[0.02] text-ink hover:border-strong hover:bg-white/[0.05]';

  const isInternal = to.startsWith('/');

  if (!isInternal) {
    return (
      <a href={to} className={cn(base, styles, className)}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={cn(base, styles, className)}>
      {children}
    </Link>
  );
}

/**
 * The surface every product mock and feature card is built on.
 *
 * A single hairline border plus a barely-there fill. On pure black that is
 * enough to establish a plane; anything heavier turns into the glassmorphism
 * this design explicitly avoids.
 */
export function Panel({
  children,
  className,
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-subtle bg-surface-raised',
        hoverable &&
          'transition-[border-color,background-color] duration-200 ease-out hover:border-strong hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </div>
  );
}
