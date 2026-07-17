import { useState } from 'react';
import { CheckCircle2, Copy, PhoneForwarded, PhoneCall, ShieldCheck } from 'lucide-react';
import {
  useCompany,
  usePhoneNumber,
  useProvisionPhoneNumber,
  useUpdateCompany,
  useVerifyForwarding,
} from '@/hooks/queries';
import { formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { LoadingBlock } from '@/components/ui/Spinner';
import { CARRIER_GUIDES } from './forwarding';

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
      <div className="card p-8 text-center">
        <PhoneForwarded className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          Get your AI receptionist number
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          We’ll set up a local number for your business (matching your area code when available) and
          connect it to your AI receptionist.
        </p>
        {provision.isError && (
          <p className="mx-auto mt-3 max-w-md text-sm text-red-600">
            {(provision.error as Error).message}
          </p>
        )}
        <Button className="mt-5" loading={provision.isPending} onClick={() => provision.mutate()}>
          <PhoneForwarded className="h-4 w-4" aria-hidden />
          Get my AI receptionist number
        </Button>
      </div>
    );
  }

  const verified = Boolean(number.forwardingVerifiedAt);

  return (
    <div className="space-y-6">
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

function NumberCard({ phoneNumber, verified }: { phoneNumber: string; verified: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold text-slate-900">Your AI Receptionist Number</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-brand-50 px-5 py-3 font-mono text-xl font-bold text-brand-800">
          {formatPhone(phoneNumber)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            AI Receptionist Active
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            AI Receptionist Not Yet Activated
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-500">
        {verified
          ? 'Calls to your business number are answered by your AI receptionist.'
          : 'Next step: forward your business phone number to this AI receptionist number. Your customers keep dialing the number they already know.'}
      </p>
    </div>
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
    <div className="card p-6">
      <h2 className="text-base font-semibold text-slate-900">Forward your business number</h2>
      <p className="mt-1 text-sm text-slate-500">
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
      <div className="mt-3 flex items-center gap-3">
        <Button variant="secondary" size="sm" loading={update.isPending} onClick={save}>
          Save
        </Button>
        {update.isSuccess && !update.isPending && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Saved
          </span>
        )}
        {update.isError && (
          <span className="text-sm text-red-600">{(update.error as Error).message}</span>
        )}
      </div>

      <ol className="mt-6 space-y-4">
        {guide.steps.map((step, index) => (
          <li key={index} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
              {index + 1}
            </span>
            <p className="text-sm text-slate-700">{fill(step)}</p>
          </li>
        ))}
      </ol>
      {guide.disable && (
        <p className="mt-4 text-xs text-slate-400">
          To stop forwarding later: {fill(guide.disable)}
        </p>
      )}
    </div>
  );
}

function VerifyCard() {
  const verify = useVerifyForwarding();

  return (
    <div className="card p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <PhoneCall className="h-4 w-4 text-brand-600" aria-hidden />
        Turn on your AI receptionist
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Once forwarding is set up, call your business number from any phone — your AI receptionist
        should answer with your greeting. Then verify below.
      </p>
      {verify.isError && (
        <p className="mt-3 text-sm text-red-600">{(verify.error as Error).message}</p>
      )}
      <Button className="mt-4" loading={verify.isPending} onClick={() => verify.mutate()}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Verify forwarding
      </Button>
    </div>
  );
}
