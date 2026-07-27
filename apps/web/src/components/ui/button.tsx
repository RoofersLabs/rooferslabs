import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-on-brand shadow-button hover:bg-accent-hover active:bg-accent-active',
  secondary: 'border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-line-strong',
  outline: 'border border-line bg-transparent text-ink hover:bg-surface-3 hover:border-line-strong',
  ghost:
    'text-ink-muted hover:bg-[var(--state-hover-overlay)] hover:text-ink active:bg-[var(--state-active-overlay)]',
  destructive:
    'bg-emergency text-ink-on-emergency shadow-button hover:bg-emergency-hover active:bg-emergency-active',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-small',
  md: 'h-10 gap-2 px-4 text-button',
  lg: 'h-12 gap-2 px-5 text-body-lg',
  'icon-sm': 'h-8 w-8 shrink-0',
  icon: 'h-10 w-10 shrink-0',
  'icon-lg': 'h-12 w-12 shrink-0',
};

/** The shared appearance, so a link that acts as a button is not a second style. */
function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-semibold',
    'transition-all duration-fast ease-standard active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: Variant;
  size?: Size;
  className?: string;
}

/**
 * A router link that looks and measures exactly like a Button.
 *
 * Navigation stays an anchor — middle-click, "open in new tab" and the status
 * bar all keep working — while the appearance comes from the one place that
 * defines it.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return <Link ref={ref} className={buttonClass(variant, size, className)} {...props} />;
});
