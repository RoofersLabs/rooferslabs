import { useId, useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { MARKETING_ROUTES } from '../routes';
import { marketingButtonClass } from '../components/Button';
import { LegalLayout } from './LegalLayout';
import { MailLink, P, Section } from './Prose';
import { CONTACT } from './content';
import { ChatBubbleLeftRightIcon, ClockIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

interface Fields {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: '', email: '', subject: '', message: '' };

/**
 * Deliberately permissive. A form that rejects a valid address because the
 * pattern was too clever is worse than one that lets a typo through — the
 * consequence of the first is a customer who cannot reach us, and of the second
 * a bounced email they can see and correct.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: Fields): Errors {
  const errors: Errors = {};
  if (!fields.name.trim()) errors.name = 'Enter your name.';
  if (!fields.email.trim()) errors.email = 'Enter your email address.';
  else if (!EMAIL.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (!fields.subject.trim()) errors.subject = 'Enter a subject.';
  if (!fields.message.trim()) errors.message = 'Enter a message.';
  return errors;
}

export function ContactPage() {
  return (
    <LegalLayout
      title="Contact us"
      subtitle="Questions about the product, your subscription, or a call that did not go the way it should have — this reaches a person."
      seoDescription="Contact rooferslabs — support email, business hours, and how quickly we reply to questions about the AI receptionist, billing, and your account."
      path={MARKETING_ROUTES.contact}
      showLastUpdated={false}
    >
      <Section id="reach-us" title="How to reach us">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailCard
            icon={<EnvelopeIcon className="h-4 w-4" aria-hidden />}
            label="Email"
            value={<MailLink email={CONTACT.email} />}
            note="The fastest route for anything — sales, support, billing, or a data request."
          />
          <DetailCard
            icon={<ClockIcon className="h-4 w-4" aria-hidden />}
            label="Business hours"
            value={<span className="text-white">{CONTACT.hours}</span>}
            note="Messages sent outside these hours are answered the next business day."
          />
          <DetailCard
            icon={<ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden />}
            label="Response time"
            value={<span className="text-white">Typically {CONTACT.responseTime}</span>}
            note="Urgent problems with a live phone line are prioritised over everything else."
            className="sm:col-span-2"
          />
        </div>
        <P>
          rooferslabs is operated by Jagadeesh Kambala. Support is handled directly rather than
          through a ticket queue, which is why the reply usually comes from a person who can
          actually change something.
        </P>
      </Section>

      <Section id="message" title="Send a message">
        <ContactForm />
      </Section>
    </LegalLayout>
  );
}

function DetailCard({
  icon,
  label,
  value,
  note,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-mk-line bg-mk-card p-5', className)}>
      <p className="flex items-center gap-2 text-[13px] uppercase tracking-[0.06em] text-mk-muted">
        <span className="text-mk-accent-fg">{icon}</span>
        {label}
      </p>
      <p className="mt-3 text-[16px] leading-[1.5]">{value}</p>
      <p className="mt-2 text-[14px] leading-[1.65] text-mk-secondary">{note}</p>
    </div>
  );
}

/**
 * The contact form.
 *
 * There is no contact endpoint on the API, and this does not pretend there is.
 * Submitting validates the fields and then hands a pre-filled message to the
 * visitor's own mail client — which genuinely works, offline included, and
 * leaves the message in their sent folder where they can see it went. The
 * alternative, a form that shows a success toast and drops the message, is the
 * one outcome worse than having no form at all.
 *
 * When a `POST /v1/contact` exists, `submit` is the only function that changes:
 * the fields, the validation, the error rendering and the states are already
 * the shape a real request needs.
 */
function ContactForm() {
  const formId = useId();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [handedOff, setHandedOff] = useState(false);

  const update = (key: keyof Fields) => (value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    // Clear this field's error as soon as it is being addressed; re-validating
    // the whole form on every keystroke would flag fields not yet reached.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setHandedOff(false);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Move focus to the first problem rather than leaving a screen-reader
      // user to hunt for what changed.
      document.getElementById(`${formId}-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const body = `${fields.message.trim()}\n\n—\n${fields.name.trim()} (${fields.email.trim()})`;
    window.location.href =
      `mailto:${CONTACT.email}` +
      `?subject=${encodeURIComponent(fields.subject.trim())}` +
      `&body=${encodeURIComponent(body)}`;
    setHandedOff(true);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={`${formId}-name`}
          label="Name"
          value={fields.name}
          onChange={update('name')}
          error={errors.name}
          autoComplete="name"
        />
        <Field
          id={`${formId}-email`}
          label="Email"
          type="email"
          value={fields.email}
          onChange={update('email')}
          error={errors.email}
          autoComplete="email"
        />
      </div>

      <Field
        id={`${formId}-subject`}
        label="Subject"
        value={fields.subject}
        onChange={update('subject')}
        error={errors.subject}
      />

      <Field
        id={`${formId}-message`}
        label="Message"
        value={fields.message}
        onChange={update('message')}
        error={errors.message}
        multiline
      />

      <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" className={marketingButtonClass('primary', 'lg')}>
          Compose message
        </button>
        <p className="text-[13.5px] leading-[1.6] text-mk-muted sm:max-w-[24rem] sm:text-right">
          This opens your email app with the message ready to send, so nothing is submitted to us
          until you send it.
        </p>
      </div>

      {/* Announced rather than shown silently: the visual result of a mailto is
          a window appearing outside the browser, which a screen-reader user may
          not notice at all. */}
      <p aria-live="polite" className="min-h-[1.25rem] text-[14px] text-mk-secondary">
        {handedOff && (
          <>
            Your email app should have opened. If nothing happened, write to us directly at{' '}
            <MailLink email={CONTACT.email} />.
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  multiline = false,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  multiline?: boolean;
  autoComplete?: string;
}) {
  const errorId = `${id}-error`;
  const control = cn(
    'w-full rounded-lg border bg-white/[0.03] px-4 py-3 text-[15px] text-white',
    'placeholder:text-white/30',
    'transition-colors duration-200 ease-smooth',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    error ? 'border-red-400/60' : 'border-mk-line hover:border-mk-line-strong',
  );

  return (
    <div className={multiline ? undefined : 'min-w-0'}>
      <label htmlFor={id} className="block text-[14px] font-medium text-white/90">
        {label}
      </label>
      <div className="mt-2">
        {multiline ? (
          <textarea
            id={id}
            rows={6}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(control, 'resize-y')}
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value}
            autoComplete={autoComplete}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={control}
          />
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-[13.5px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
