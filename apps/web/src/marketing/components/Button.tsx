import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary';
type Size = 'md' | 'lg';

const base = cn(
  'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
  'rounded-lg font-medium tracking-[-0.01em]',
  'transition-[transform,background-color,border-color,box-shadow] duration-200 ease-smooth',
  'hover:-translate-y-px active:translate-y-0 active:duration-75',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black',
  'motion-reduce:transform-none motion-reduce:transition-none',
);

const variants: Record<Variant, string> = {
  // The only saturated surface on the page. The inset highlight is a 1px top
  // rim, not a gradient — it reads as a lit edge and keeps the fill flat.
  primary: cn(
    'bg-mk-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
    'hover:bg-mk-accent-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_28px_-8px_rgba(43,92,230,0.7)]',
  ),
  // Card surface, hairline border. The border is what animates on hover; the
  // fill barely moves, which keeps it subordinate to the primary action.
  secondary: cn(
    'border border-mk-line bg-mk-card text-white',
    'hover:border-mk-line-strong hover:bg-mk-card-hover',
  ),
};

const sizes: Record<Size, string> = {
  md: 'h-9 px-4 text-[13.5px]',
  lg: 'h-11 px-5 text-[15px]',
};

type ButtonProps = {
  children: ReactNode;
  /** Router path (`/sign-up`) or in-page anchor (`#pricing`). */
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
};

/**
 * Every call to action on the marketing site. Renders a router `Link` for app
 * routes and a plain anchor for in-page targets, so in-page navigation keeps
 * native smooth-scroll behaviour and a real URL fragment.
 */
export function Button({
  children,
  href,
  variant = 'primary',
  size = 'md',
  className,
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (href.startsWith('#')) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} className={classes}>
      {children}
    </Link>
  );
}
