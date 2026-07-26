import type { ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';

export const fieldClass = 'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm';
export const labelClass = 'block text-sm font-medium text-gray-700';

/** Label + control + inline validation message, so every step looks the same. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: FieldError;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
}

/** The footer every step shares: back on the left, continue on the right. */
export function StepActions({
  onBack,
  submitting,
  submitLabel = 'Continue',
}: {
  onBack?: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export function StepError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return <p className="text-sm text-red-600">{message}</p>;
}

export function StepHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{blurb}</p>
    </header>
  );
}
