import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-ink-on-brand shadow-button hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-line-strong',
  ghost:
    'text-ink-muted hover:bg-[var(--state-hover-overlay)] hover:text-ink active:bg-[var(--state-active-overlay)]',
  destructive:
    'bg-emergency text-ink-on-emergency shadow-button hover:bg-emergency-hover active:bg-emergency-active',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-small',
  md: 'h-10 gap-2 px-4 text-button',
  lg: 'h-12 gap-2 px-5 text-body-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-semibold',
        'transition-all duration-fast ease-standard active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
