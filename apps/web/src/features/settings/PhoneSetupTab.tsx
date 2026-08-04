import { useState } from 'react';
import {
  useCompany,
  usePhoneNumber,
  useProvisionPhoneNumber,
  useReceptionistStatus,
  useSetReceptionistEnabled,
  useUpdateCompany,
  useVerifyForwarding,
} from '@/hooks/queries';
import { cn, formatPhone, humanizeEnum } from '@/lib/utils';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Input, Select } from '@/components/ui/input';
import { LoadingBlock } from '@/components/ui/spinner';
import { CARRIER_GUIDES } from './forwarding';
import {
  CheckCircleIcon,
  DocumentDuplicateIcon,
  PhoneArrowDownLeftIcon,
  PhoneArrowUpRightIcon,
  PowerIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

/**
 * Phone Setup: the owner's activation journey, in plain language —
 * 1. Your AI receptionist number (provisioned automatically at onboarding).
 * 2. Forward your business line to it (carrier-specific steps).
 * 3. Verify with a test call → "AI Receptionist Active".
 */
export function PhoneSetupTab() {
  const phone = usePhoneNumber();
  const company = useCompany();
  const provision = useProvisionPhoneNumber();

  if (phone.isLoading || company.isLoading || !company.data) return <LoadingBlock />;

  const number = phone.data;
  if (!number) {
    return (
      <Card className="items-center px-8 py-12 text-center">
        <IconTile icon={PhoneArrowUpRightIcon} size="xl" />
        <h2 className="mt-5 text-h4 text-ink">Get your AI receptionist number</h2>
        <p className="mt-1.5 max-w-md text-body leading-6 text-ink-muted">
          We’ll set up a local number for your business (matching your area code when available) and
          connect it to your AI receptionist.
        </p>
        {provision.isError && (
          <Alert className="mt-5 w-full max-w-md text-left" tone="danger">
            {(provision.error as Error).message}
          </Alert>
        )}
        <Button className="mt-6" loading={provision.isPending} onClick={() => provision.mutate()}>
          <PhoneArrowUpRightIcon className="h-4 w-4" aria-hidden />
          Get my AI receptionist number
        </Button>
      </Card>
    );
  }

  const verified = Boolean(number.forwardingVerifiedAt);

  return (
    <div className="space-y-6">
      <ControlCenterCard />
      <NumberCard phoneNumber={number.phoneNumber} verified={verified} />
      <ForwardingCard
        aiNumber={number.phoneNumber}
        businessPhone={company.data.phone}
        carrier={company.data.phoneCarrier}
      />
      {!verified && <VerifyCard />}
    </div>
  );
}

/**
 * The control center: everything about the receptionist at a glance, plus the
 * master ON/OFF switch. Off = callers hear a polite unavailable message;
 * nothing is deleted and the number stays reserved. On = answering resumes
 * instantly.
 */
function ControlCenterCard() {
  const status = useReceptionistStatus();
  const toggle = useSetReceptionistEnabled();

  if (status.isLoading || !status.data) return <LoadingBlock />;
  const s = status.data;

  return (
    <Card className="px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-h5 text-ink">AI Receptionist</h2>
          <p className="mt-1 text-small text-ink-muted">
            {s.enabled
              ? 'Answering forwarded calls, capturing leads, and updating your dashboard.'
              : 'Off — callers hear a polite unavailable message. Your number stays reserved; turn it back on anytime.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={s.enabled}
          aria-label={s.enabled ? 'Turn the AI receptionist off' : 'Turn the AI receptionist on'}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(!s.enabled)}
          className={cn(
            'focus-ring relative inline-flex h-9 w-[104px] shrink-0 items-center rounded-full transition-colors duration-base ease-standard',
            s.enabled ? 'bg-success' : 'bg-line-strong',
            toggle.isPending && 'opacity-60',
          )}
        >
          <span
            className={cn(
              'absolute text-caption font-bold',
              s.enabled ? 'left-4 text-ink-on-brand' : 'right-4 text-ink',
            )}
          >
            {s.enabled ? 'ON' : 'OFF'}
          </span>
          <span
            className={cn(
              'inline-block h-7 w-7 transform rounded-full bg-surface shadow-button transition-transform duration-base ease-spring',
              s.enabled ? 'translate-x-[72px]' : 'translate-x-1',
            )}
          >
            <PowerIcon
              className={cn('m-1.5 h-4 w-4', s.enabled ? 'text-success' : 'text-ink-faint')}
              aria-hidden
            />
          </span>
        </button>
      </div>

      {toggle.isError && (
        <Alert className="mt-4" tone="danger">
          {(toggle.error as Error).message}
        </Alert>
      )}

      <dl className="mt-5 grid gap-x-8 gap-y-3 text-small sm:grid-cols-2 lg:grid-cols-3">
        <StatusRow label="Business Phone Number" value={formatPhone(s.businessPhone)} />
        <StatusRow label="AI Receptionist Number" value={formatPhone(s.aiPhoneNumber)} />
        <StatusRow
          label="Carrier"
          value={
            s.carrier
              ? (CARRIER_GUIDES.find((g) => g.id === s.carrier)?.label ?? humanizeEnum(s.carrier))
              : '—'
          }
        />
        <StatusRow
          label="Forwarding Status"
          value={s.forwardingVerified ? 'Verified' : 'Not Verified'}
          tone={s.forwardingVerified ? 'good' : 'warn'}
        />
        <StatusRow
          label="AI Receptionist Status"
          value={s.enabled ? 'Active' : 'Disabled'}
          tone={s.enabled ? 'good' : 'warn'}
        />
      </dl>
    </Card>
  );
}

/** Small caps eyebrow marking a card's place in the 3-step activation journey. */
function StepEyebrow({ step }: { step: number }) {
  return (
    <p className="mb-1.5 text-caption uppercase tracking-wider text-accent">Step {step} of 3</p>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 font-medium',
          tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function NumberCard({ phoneNumber, verified }: { phoneNumber: string; verified: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="px-6 py-6">
      <StepEyebrow step={1} />
      <h2 className="text-h5 text-ink">Your AI Receptionist Number</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="font-num border border-accent-border bg-accent-subtle px-5 py-2.5 text-h4 text-accent">
          {formatPhone(phoneNumber)}
        </span>
        <Button variant="secondary" onClick={() => void copy()}>
          <DocumentDuplicateIcon className="h-4 w-4" aria-hidden />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        {verified ? (
          <Badge tone="success">
            <ShieldCheckIcon className="h-4 w-4" aria-hidden />
            AI Receptionist Active
          </Badge>
        ) : (
          <Badge tone="warning">AI Receptionist Not Yet Activated</Badge>
        )}
      </div>
      <p className="mt-3 text-small text-ink-muted">
        {verified
          ? 'Calls to your business number are answered by your AI receptionist.'
          : 'Next step: forward your business phone number to this AI receptionist number. Your customers keep dialing the number they already know.'}
      </p>
    </Card>
  );
}

function ForwardingCard({
  aiNumber,
  businessPhone,
  carrier,
}: {
  aiNumber: string;
  businessPhone: string | null;
  carrier: string | null;
}) {
  const update = useUpdateCompany();
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [carrierInput, setCarrierInput] = useState<string | null>(null);

  const selectedCarrier = carrierInput ?? carrier ?? 'other';
  const guide = CARRIER_GUIDES.find((g) => g.id === selectedCarrier) ?? CARRIER_GUIDES.at(-1)!;
  const pretty = formatPhone(aiNumber);
  const fill = (text: string) => text.replace(/\{number\}/g, pretty);

  const save = () => {
    update.mutate({
      phone: (phoneInput ?? businessPhone ?? '') || undefined,
      phoneCarrier: selectedCarrier,
    });
  };

  return (
    <Card className="px-6 py-6">
      <StepEyebrow step={2} />
      <h2 className="text-h5 text-ink">Forward your business number</h2>
      <p className="mt-1 text-small text-ink-muted">
        You keep your existing number — customers keep dialing it. Your phone provider sends the
        calls to your AI receptionist, which answers as your office.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Your business phone number"
          placeholder="+1 512 555 0100"
          value={phoneInput ?? businessPhone ?? ''}
          onChange={(e) => setPhoneInput(e.target.value)}
        />
        <Select
          label="Your phone provider"
          value={selectedCarrier}
          onChange={(e) => setCarrierInput(e.target.value)}
        >
          {CARRIER_GUIDES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" loading={update.isPending} onClick={save}>
          Save
        </Button>
        {update.isSuccess && !update.isPending && (
          <span className="flex items-center gap-1.5 text-small font-medium text-success">
            <CheckCircleIcon className="h-4 w-4" aria-hidden />
            Saved
          </span>
        )}
        {update.isError && (
          <span className="text-small text-emergency" role="alert">
            {(update.error as Error).message}
          </span>
        )}
      </div>

      <ol className="mt-6 space-y-4">
        {guide.steps.map((step, index) => (
          <li key={index} className="flex gap-4">
            <span className="font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-bold text-ink-on-brand">
              {index + 1}
            </span>
            <p className="text-small text-ink">{fill(step)}</p>
          </li>
        ))}
      </ol>
      {guide.disable && (
        <p className="mt-4 text-caption text-ink-faint">
          To stop forwarding later: {fill(guide.disable)}
        </p>
      )}
    </Card>
  );
}

function VerifyCard() {
  const verify = useVerifyForwarding();

  return (
    <Card className="px-6 py-6">
      <StepEyebrow step={3} />
      <h2 className="flex items-center gap-2 text-h5 text-ink">
        <PhoneArrowDownLeftIcon className="h-4 w-4 text-accent" aria-hidden />
        Turn on your AI receptionist
      </h2>
      <p className="mt-1 text-small text-ink-muted">
        Once forwarding is set up, call your business number from any phone — your AI receptionist
        should answer with your greeting. Then verify below.
      </p>
      {verify.isError && (
        <Alert className="mt-4" tone="danger">
          {(verify.error as Error).message}
        </Alert>
      )}
      <Button
        className="mt-5 self-start"
        loading={verify.isPending}
        onClick={() => verify.mutate()}
      >
        <CheckCircleIcon className="h-4 w-4" aria-hidden />
        Verify forwarding
      </Button>
    </Card>
  );
}
