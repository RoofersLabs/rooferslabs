import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary';
type Size = 'md' | 'lg';

const base = cn(
  'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
  'rounded-none font-medium tracking-[-0.01em]',
  'transition-[transform,background-color,border-color,box-shadow,opacity] duration-200 ease-smooth',
  'hover:-translate-y-px active:translate-y-0 active:duration-75',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black',
  'motion-reduce:transform-none motion-reduce:transition-none',
);

const variants: Record<Variant, string> = {
  primary: cn(
    'border border-white bg-white text-black shadow-[0_1px_0_rgba(255,255,255,0.08)]',
    'hover:bg-neutral-200 hover:shadow-[0_12px_28px_-22px_rgba(255,255,255,0.65)]',
  ),
  secondary: cn(
    'border border-white bg-white text-black shadow-[0_1px_0_rgba(255,255,255,0.08)]',
    'hover:bg-neutral-200 hover:shadow-[0_12px_28px_-22px_rgba(255,255,255,0.65)]',
  ),
};

const sizes: Record<Size, string> = {
  md: 'h-9 px-4 text-[13.5px]',
  lg: 'h-11 px-5 text-[15px]',
};

/**
 * The button's appearance, for the one case this component cannot render.
 *
 * Every call to action on the marketing site is a link, which is why `Button`
 * takes an `href` and has no element to submit anything. The contact form needs
 * a real `<button type="submit">` — a link cannot submit a form, and faking it
 * with an onClick would break keyboard submit and the Enter key in a field.
 *
 * Exported as a class string rather than adding a rendering branch above:
 * nothing about the existing component changes, so no existing call site can
 * behave differently, and the styling still lives in exactly one place.
 */
export function marketingButtonClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

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
