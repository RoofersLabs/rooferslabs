import type { ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Onboarding registers its inputs with `react-hook-form`, which wants a bare
 * element rather than the controlled `Input`/`Select` components. These class
 * strings are therefore the declarations those components make, applied
 * directly — the same 40px height, radius, border and hover as every other
 * control in the product. They are not a second styling scheme: a change to
 * form control styling belongs in components/ui/input.tsx, and then here.
 */
export const fieldClass =
  'focus-ring mt-1.5 block h-10 w-full rounded-md border border-line bg-surface px-3 text-form-input text-ink transition-colors duration-fast ease-standard placeholder:text-ink-faint hover:border-line-strong';

/** The same control sized for a textarea, which grows by rows instead. */
export const textareaClass =
  'focus-ring mt-1.5 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-form-input text-ink transition-colors duration-fast ease-standard placeholder:text-ink-faint hover:border-line-strong';

export const labelClass = 'block text-form-label font-medium text-ink-muted';

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
      {hint && !error && <p className="mt-1.5 text-small text-ink-faint">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-small text-emergency" role="alert">
          {error.message}
        </p>
      )}
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
    <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-5">
      {onBack ? (
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" loading={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}

export function StepError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <p
      className="rounded-md border border-emergency-border bg-emergency-subtle px-4 py-3 text-small text-emergency"
      role="alert"
    >
      {message}
    </p>
  );
}

export function StepHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header>
      <h1 className="text-h2 text-ink">{title}</h1>
      <p className="mt-1.5 text-body-lg text-ink-muted">{blurb}</p>
    </header>
  );
}

/** Placeholder shown while a step's saved answers are still loading. */
export function StepLoading() {
  return (
    <div role="status" aria-label="Loading your saved answers" className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="space-y-5 rounded-xl border border-line-subtle bg-surface p-6 shadow-card">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-2/3" />
      </div>
    </div>
  );
}
