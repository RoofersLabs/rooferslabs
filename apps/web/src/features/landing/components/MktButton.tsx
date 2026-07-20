import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type MktVariant = 'primary' | 'secondary' | 'ghost' | 'inverse';
export type MktSize = 'sm' | 'md' | 'lg';

/**
 * Marketing CTA styling. Kept separate from the app's `<Button>` on purpose:
 * this one is gradient-filled and glow-shadowed, which would be wrong inside
 * the dashboard, and it reads from `mkt-*` tokens that don't exist there.
 */
const variants: Record<MktVariant, string> = {
  // The single loudest element on the page — gradient fill, lit top edge, halo.
  primary:
    'bg-mkt-cta text-mkt-accent-ink shadow-mkt-cta hover:bg-mkt-cta-hover hover:-translate-y-px active:translate-y-0',
  secondary:
    'bg-mkt-surface text-mkt-ink-body border border-mkt-line shadow-mkt-xs hover:border-mkt-line-strong hover:text-mkt-ink',
  ghost: 'text-mkt-ink-muted hover:text-mkt-ink hover:bg-mkt-accent-soft',
  // For use on the dark CTA band, where the page ground is already dark.
  inverse: 'bg-white text-[#101218] shadow-mkt-md hover:-translate-y-px active:translate-y-0',
};

const sizes: Record<MktSize, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-[0.9375rem]',
  lg: 'h-12 gap-2 px-6 text-base',
};

function base(variant: MktVariant, size: MktSize, className?: string) {
  return cn(
    'mkt-focus-ring inline-flex select-none items-center justify-center whitespace-nowrap',
    'rounded-xl font-medium transition-all duration-200 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

/** Inner top highlight — the 1px that stops a filled button looking flat. */
const litEdge = { boxShadow: 'var(--mkt-shadow-cta), var(--mkt-inner-highlight)' };

export function MktButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: MktVariant; size?: MktSize }) {
  return (
    <button
      className={base(variant, size, className)}
      style={variant === 'primary' ? litEdge : undefined}
      {...props}
    >
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
  const style = variant === 'primary' ? litEdge : undefined;

  if (isExternal) {
    return (
      <a href={to} className={cls} style={style} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} style={style} {...props}>
      {children}
    </Link>
  );
}
