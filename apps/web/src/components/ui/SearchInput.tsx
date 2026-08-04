import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Required: the field carries no visible label, so it needs an accessible one. */
  'aria-label': string;
  /**
   * Overrides on the `<input>` itself. `className` styles the wrapper, which
   * cannot reach the control's own radius or border. Optional and merged last,
   * so every existing caller keeps the default field exactly as it was.
   */
  inputClassName?: string;
}

/**
 * The application's search field.
 *
 * Calls, Customers, Knowledge and the header each grew their own copy of this
 * markup, which is how they ended up with three different radii and two
 * different backgrounds. One component now owns the leading icon, the height,
 * and the hover/focus treatment, all matching the shared form controls.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, inputClassName, ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <MagnifyingGlassIcon
        className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        className={cn(
          // Pill, deliberately, and the one exception to the product's square
          // structural geometry: a search field is a control, and it shares a
          // row with pill buttons on every page that renders it. `pl-10`/`pr-4`
          // rather than `pl-9`/`pr-3` because a pill's corners eat into the
          // usable ends — text set to a square field's insets looks pinched
          // against the curve.
          'focus-ring h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-form-input text-ink transition-colors duration-fast ease-standard placeholder:text-ink-faint hover:border-line-strong',
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
});
