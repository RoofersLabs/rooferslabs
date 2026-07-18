import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const baseField =
  'focus-ring block w-full rounded-md border border-line bg-surface px-3 py-2 text-form-input text-ink placeholder:text-ink-faint transition-colors duration-fast ease-standard hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60';

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
        className={cn(baseField, error && 'border-emergency-border', className)}
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
        className={cn(baseField, error && 'border-emergency-border', className)}
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
        className={cn(baseField, error && 'border-emergency-border', className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});
