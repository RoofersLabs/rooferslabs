import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconTile } from '@/components/ui/IconTile';
import { Modal } from '@/components/ui/Modal';
import { submitEarlyAccess } from './launchMode';
import { trackLaunchEvent } from './analytics';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The early-access form.
 *
 * Submitting creates a sales lead and nothing else — no account, no tenant, no
 * access. That is stated on the form so nobody submits it expecting to be let
 * in, and enforced server-side where it actually matters.
 */
export function EarlyAccessDialog({ open, onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await submitEarlyAccess({
        name: String(form.get('name') ?? '').trim(),
        company: String(form.get('company') ?? '').trim(),
        email: String(form.get('email') ?? '').trim(),
        phone: String(form.get('phone') ?? '').trim() || undefined,
      });
      trackLaunchEvent('early_access_requested');
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Reset on close so reopening offers a blank form rather than the receipt
  // from last time.
  function handleClose() {
    onClose();
    window.setTimeout(() => {
      setSubmitted(false);
      setError(null);
    }, 200);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={submitted ? 'Request received' : 'Request early access'}
    >
      {submitted ? (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <IconTile icon={CheckCircle2} tone="success" size="xl" shape="square" />
          <p className="mt-5 text-body leading-6 text-ink-muted">
            Thanks — we have your details. We&rsquo;ll be in touch as we open access to more roofing
            companies.
          </p>
          <Button className="mt-6" variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-body leading-6 text-ink-muted">
            Tell us about your company and we&rsquo;ll reach out as we onboard our next group.
          </p>

          <Input name="name" label="Name" autoComplete="name" required maxLength={160} />
          <Input
            name="company"
            label="Company"
            autoComplete="organization"
            required
            maxLength={200}
          />
          <Input
            name="email"
            type="email"
            label="Work email"
            autoComplete="email"
            required
            maxLength={320}
          />
          <Input
            name="phone"
            type="tel"
            label="Phone"
            hint="Optional"
            autoComplete="tel"
            maxLength={32}
          />

          {error && (
            <p role="alert" className="text-small text-emergency">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Request early access'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
