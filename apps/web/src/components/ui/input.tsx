import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Form control styling, defined once.
 *
 * The radius matches Button (`rounded-md`) and the height matches Button's `md`
 * size (40px), so a field, a select and a button standing side by side in a
 * toolbar or a card footer line up on both edges. Textareas opt out of the
 * fixed height below, since they grow by rows.
 *
 * Focus is `.focus-field` rather than the `.focus-ring` a button uses: the ring
 * hugs the control instead of floating clear of it, which stops a focused field
 * from reading as two nested rectangles. `.focus-field` owns the transition, so
 * there is deliberately no `transition-colors` here to fight it.
 */
const baseField =
  'focus-field block w-full rounded-md border border-line bg-surface px-3 text-form-input text-ink placeholder:text-ink-faint hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface-disabled disabled:text-ink-disabled disabled:hover:border-line';

/** Single-line controls sit at the shared 40px control height. */
const fixedHeightField = cn(baseField, 'h-10 py-0');

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, hint, error, id, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-form-label font-medium text-ink-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-small text-emergency" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-small text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={id}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(fixedHeightField, error && 'border-emergency', className)}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id: idProp, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={id}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(baseField, 'py-2.5', error && 'border-emergency', className)}
        {...props}
      />
    </FieldWrapper>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id: idProp, children, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <FieldWrapper label={label} hint={hint} error={error} id={id}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(
          fixedHeightField,
          // The product's own chevron, so a select matches the inputs beside it
          // on every platform instead of wearing the OS arrow.
          'select-chevron cursor-pointer pr-10',
          error && 'border-emergency',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});

/**
 * The product's only checkbox. Every tick box in the application renders
 * through this, so size, checked colour and focus ring can never drift between
 * the settings forms and the onboarding wizard.
 *
 * `accent-accent` tints the native control with the brand blue. The native
 * control is used on purpose: there is no forms plugin in the Tailwind build,
 * so a hand-drawn box would lose the platform's own checked/indeterminate
 * rendering and its keyboard behaviour for nothing.
 */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'focus-ring accent-accent h-4 w-4 shrink-0 cursor-pointer',
          'disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
        {...props}
      />
    );
  },
);
