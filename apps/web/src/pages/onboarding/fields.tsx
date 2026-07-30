import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Onboarding registers its inputs with `react-hook-form`, which wants a bare
 * element rather than the controlled `Input`/`Select` components. These class
 * strings are therefore the declarations those components make, applied
 * directly. Border, background, colour, focus (`.focus-field`) and the select
 * chevron are the product's, verbatim — a change to any of those belongs in
 * components/ui/input.tsx, and then here.
 *
 * Two measurements are deliberately the wizard's own. Controls stand at 44px
 * rather than the dashboard's 40px, and carry the 16px radius the dashboard
 * gives its search field rather than the 12px of a dense table filter. Setup is
 * a full-screen flow met once, usually on a phone, often on a roof: it is the
 * one place in the product that should be sized for a gloved thumb rather than
 * for density. Everything else — every colour, every state — is shared.
 */
const fieldBase =
  'focus-field block w-full rounded-xl border border-line bg-surface text-form-input text-ink placeholder:text-ink-faint hover:border-line-strong';

export const fieldClass = cn(fieldBase, 'mt-2 h-11 px-3.5');

/** The same control sized for a textarea, which grows by rows instead. */
export const textareaClass = cn(fieldBase, 'mt-2 resize-y px-3.5 py-3');

/** A select adds the product chevron and the room to draw it. */
export const selectClass = cn(fieldClass, 'select-chevron cursor-pointer pr-11');

export const labelClass = 'block text-form-label font-medium text-ink-muted';

/** Applied to a control the resolver has rejected, so invalid state is not colour-in-text alone. */
const invalidClass =
  'border-emergency hover:border-emergency focus-visible:border-emergency focus-visible:ring-emergency-border';

/** The subset of a control's props `Field` attaches to it. */
interface ControlProps {
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Label + control + one message line, so every step looks the same.
 *
 * The hint and the validation message occupy the same slot: a field never shows
 * both, and swapping one for the other in place means the form does not grow by
 * a line the moment it is submitted. The control is cloned rather than wrapped
 * so `aria-invalid`, `aria-describedby` and the invalid border can be attached
 * to the real input without every caller having to repeat them.
 */
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
  const message = error?.message ?? hint;
  const messageId = `${htmlFor}-message`;
  const child = Children.only(children);

  const control = isValidElement<ControlProps>(child)
    ? cloneElement(child, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? messageId : undefined,
        className: cn(child.props.className, error && invalidClass),
      })
    : child;

  return (
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {control}
      {message && (
        <p
          id={messageId}
          className={cn('mt-2 text-small', error ? 'text-emergency' : 'text-ink-faint')}
          role={error ? 'alert' : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * The sheet a step's questions sit on.
 *
 * A `Card` with three deliberate changes: 20px corners instead of 16, so the
 * sheet still reads as rounder than the 16px controls nested inside it; the
 * next elevation up, which is what lifts it off the page rather than sitting
 * flush on it; and 32px gutters from `sm` up, because a form met once deserves
 * more air than a table row scanned a hundred times. It enters a beat after the
 * heading, which is the only sequencing in the flow.
 */
export function StepCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Card
      as="form"
      className={cn(
        'animate-rise-in gap-6 rounded-2xl p-6 shadow-md [animation-delay:80ms] sm:p-8',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A checkbox presented as a selectable panel rather than a tick beside a line
 * of text.
 *
 * The whole panel is the hit target, which is what makes these usable with a
 * thumb, and the selected state is the pale brand tint the sidebar already uses
 * for the active page — so "on" looks the same here as it will everywhere after
 * setup. The tint is deliberately paired with a pale border rather than the
 * solid brand one: at full strength a column of these reads as a stack of
 * outlined boxes competing with the heading. The checked box carries the state
 * too, so nothing here depends on colour alone.
 */
export function ToggleCard({
  checked,
  title,
  blurb,
  children,
}: {
  checked: boolean;
  title: string;
  blurb?: string;
  /** The `Checkbox`, registered by the caller. */
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-fast ease-standard',
        checked
          ? 'border-accent-border bg-accent-subtle'
          : 'border-line-subtle bg-surface hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <span className="flex h-6 items-center">{children}</span>
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">{title}</span>
        {blurb && <span className="mt-0.5 block text-small text-ink-muted">{blurb}</span>}
      </span>
    </label>
  );
}

/**
 * The field a toggle reveals. It fades in on its own rather than appearing
 * instantly, so the form is never seen to jump under the pointer that caused it.
 */
export function RevealedField({ children }: { children: ReactNode }) {
  return <div className="animate-rise-in">{children}</div>;
}

/**
 * A labelled group of controls that is not a single field — business hours, the
 * receptionist's capabilities. It draws the same label as `Field` so a legend
 * and a label never disagree by a pixel or a weight.
 */
export function FieldGroup({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{label}</legend>
      {hint && <p className="mt-1 text-small text-ink-faint">{hint}</p>}
      <div className="mt-3">{children}</div>
      {error && (
        <p className="mt-2 text-small text-emergency" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The footer every step shares.
 *
 * On a phone the primary action goes full width and sits above "Back", which
 * puts it under the thumb and keeps the destructive-to-progress direction out
 * of the way. From `sm` up the pair returns to the usual back-left,
 * continue-right row.
 *
 * The actions take the product's standard `md` button — 14px button type, 16px
 * gutters — lifted to 44px so they stand exactly as tall as the fields above
 * them and stay comfortable under a thumb. The previous `lg` was 48px on 18px
 * type, which read as the largest thing on a page whose job is to be calm.
 * Everything else about the button, states included, is the shared component's.
 */
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
    <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
      {onBack && (
        <Button type="button" variant="ghost" size="md" onClick={onBack} className="h-11 px-3">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
      )}
      <Button
        type="submit"
        size="md"
        loading={submitting}
        className={cn('h-11 w-full sm:w-auto', !onBack && 'sm:ml-auto')}
      >
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  );
}

export function StepError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <Alert tone="danger" className="animate-fade-in">
      {message}
    </Alert>
  );
}

/**
 * The title block of a step.
 *
 * The heading steps down a size below `sm` so "Create your organization" reads
 * as one confident line on a phone instead of a two-line wall, and the blurb is
 * held to a comfortable measure rather than running the full width of the sheet.
 */
export function StepHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <header className="animate-rise-in">
      <h1 className="text-h3 text-ink sm:text-h2">{title}</h1>
      <p className="mt-2.5 max-w-[54ch] text-body-lg text-ink-muted">{blurb}</p>
    </header>
  );
}

/**
 * Placeholder shown while a step's saved answers are still loading.
 *
 * It stands on the real geometry — same heading sizes, same sheet radius,
 * padding and elevation, same field height — so the arriving form replaces it
 * without anything moving.
 */
export function StepLoading() {
  return (
    <div role="status" aria-label="Loading your saved answers" className="space-y-8 sm:space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3 max-w-[22rem] sm:h-10" />
        <Skeleton className="h-6 w-full max-w-[28rem]" />
      </div>
      <div className="space-y-6 rounded-2xl border border-line-subtle bg-surface p-6 shadow-md sm:p-8">
        {[0, 1, 2].map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
