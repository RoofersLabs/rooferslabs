import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <input
        ref={ref}
        type="search"
        className={cn(
          'focus-ring h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-form-input text-ink transition-colors duration-fast ease-standard placeholder:text-ink-faint hover:border-line-strong',
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
});
