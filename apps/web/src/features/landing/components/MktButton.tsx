import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type MktVariant = 'primary' | 'secondary' | 'ghost' | 'inverse';
export type MktSize = 'sm' | 'md' | 'lg';

/**
 * Marketing CTA styling. Kept separate from the app's `<Button>` on purpose:
 * this one is a full pill built on `mkt-*` tokens that don't exist in the
 * dashboard, and the dashboard's square-ish buttons would look wrong here.
 *
 * The primary is a solid neutral rather than a brand colour — near-black on the
 * light theme, white on the dark one. Both themes therefore get the same
 * button at the same visual weight, which is the whole point: a coloured CTA
 * would have to be redesigned per theme to keep the same prominence.
 */
const variants: Record<MktVariant, string> = {
  primary: 'bg-mkt-solid text-mkt-solid-ink shadow-mkt-solid hover:bg-mkt-solid-hover',
  secondary:
    'bg-mkt-surface text-mkt-ink-body border border-mkt-line shadow-mkt-xs hover:border-mkt-line-strong hover:text-mkt-ink',
  // Deliberately quiet: no fill, no border, no wash. For the secondary CTA that
  // must not compete with the primary.
  ghost: 'text-mkt-ink-muted hover:text-mkt-ink',
  // For use on the dark CTA band, where the page ground is already dark.
  inverse: 'bg-white text-[#08090a] shadow-mkt-md hover:bg-mkt-gray-200',
};

// Generous horizontal padding at every step — a pill reads as premium only when
// the label has room to breathe inside it.
const sizes: Record<MktSize, string> = {
  sm: 'h-9 gap-1.5 px-5 text-sm',
  md: 'h-10 gap-2 px-6 text-sm',
  lg: 'h-11 gap-2 px-7 text-base',
};

function base(variant: MktVariant, size: MktSize, className?: string) {
  return cn(
    'mkt-focus-ring inline-flex select-none items-center justify-center whitespace-nowrap',
    'rounded-full font-medium transition-colors duration-200 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

export function MktButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: MktVariant; size?: MktSize }) {
  return (
    <button className={base(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

/**
 * Same styling as a link. Internal targets route through react-router; anything
 * with a scheme or a hash falls back to a plain anchor.
 */
export function MktLinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string;
  variant?: MktVariant;
  size?: MktSize;
  children: ReactNode;
}) {
  const isExternal = /^([a-z]+:)?\/\//i.test(to) || to.startsWith('#') || to.startsWith('mailto:');
  const cls = base(variant, size, className);

  if (isExternal) {
    return (
      <a href={to} className={cls} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} {...props}>
      {children}
    </Link>
  );
}
