import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/**
 * Colour is untouched — every value here is the token it already was, so
 * contrast is exactly what it was measured at.
 *
 * The one addition is `active:shadow-none` on the two raised variants: a
 * pressed button settles flat against the surface, which is the other half of
 * the 2% scale. The bordered and ghost variants have no elevation to lose, so
 * they say nothing about it.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-on-brand shadow-button hover:bg-accent-hover active:bg-accent-active active:shadow-none',
  secondary: 'border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-line-strong',
  outline: 'border border-line bg-transparent text-ink hover:bg-surface-3 hover:border-line-strong',
  ghost:
    'text-ink-muted hover:bg-[var(--state-hover-overlay)] hover:text-ink active:bg-[var(--state-active-overlay)]',
  destructive:
    'bg-emergency text-ink-on-emergency shadow-button hover:bg-emergency-hover active:bg-emergency-active active:shadow-none',
};

/**
 * Heights are unchanged; the horizontal padding is not.
 *
 * On a pill the end cap is a semicircle of radius h/2, so padding smaller than
 * that puts the first glyph inside the curve — the text reads as pressed
 * against the edge even though the number says otherwise. Each size therefore
 * pads to exactly half its height (16/20/24 against 32/40/48), which is where
 * the straight edge begins and the classic pill proportion sits.
 *
 * That is +4px a side over the old 16px-radius shape, so every labelled button
 * is 8px wider than it was. Icon sizes are square and unaffected.
 */
const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-4 text-small',
  md: 'h-10 gap-2 px-5 text-button',
  lg: 'h-12 gap-2 px-6 text-body-lg',
  'icon-sm': 'h-8 w-8 shrink-0',
  icon: 'h-10 w-10 shrink-0',
  'icon-lg': 'h-12 w-12 shrink-0',
};

/**
 * The shared appearance, so a link that acts as a button is not a second style.
 *
 * Exported for the cases the two components below cannot cover: a plain `<a>`
 * carrying a non-router href, such as `tel:`, which must stay an anchor for the
 * phone to dial it.
 */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    // `rounded-full` is --radius-full, the token, not a magic 9999px. Every
    // button in the product is a pill because this one line says so — variants,
    // sizes, `ButtonLink`, the `tel:` anchors that borrow `buttonClass`, and
    // every consumer from pagination to the dialog's close button.
    //
    // A square icon size lands on a circle, which is the same statement: the
    // shape is a function of the height, so it needs no separate rule.
    //
    // The variant's own text color survives this merge now that `cn` can tell a
    // `text-*` size from a `text-*` color; before, the size class below silently
    // deleted it and every button inherited near-black.
    'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-full font-semibold',
    // One icon size for every button in the product, set here rather than at the
    // call sites — which is what stopped a 12px glyph on one page and a 16px one
    // on the next. 18px is the brief's action size: large enough to read beside
    // a 14px label, small enough that it never out-weighs it. A call site can
    // still override, and `size-*` loses to a later `h-*/w-*` in twMerge.
    '[&_svg]:size-[18px] [&_svg]:shrink-0',
    // Named properties rather than `transition-all`.
    //
    // `all` also animates layout — width, padding, height — so a button that
    // reflowed for any reason (a label swapping on load, a breakpoint, a
    // `loading` spinner appearing) spent 150ms visibly resizing. These six are
    // the ones a button actually changes, and colour, shadow and transform are
    // the three the brief asks to be smooth.
    //
    // `transform-gpu` promotes the press to its own layer so the scale is a
    // compositor transform: no layout, no paint, and it cannot judder against
    // whatever else is animating on the page.
    'transform-gpu transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-fast ease-standard',
    // 2% is deliberately almost imperceptible — felt rather than seen, which is
    // the difference between a control that responds and one that performs.
    'active:scale-[0.98]',
    // A disabled button must not appear to respond to a press it will ignore.
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
      {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />}
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
