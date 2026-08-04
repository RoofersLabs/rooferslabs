import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Clock, Bot, PhoneForwarded, CheckCircle2, Pencil } from 'lucide-react';
import { AiVoice } from '@rooferslabs/shared';
import {
  useAiConfig,
  useCompany,
  useSetBusinessHours,
  useUpdateAiConfig,
  useUpdateCompany,
} from '@/hooks/queries';
import type { BusinessHour } from '@/types/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { LoadingBlock } from '@/components/ui/spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PhoneSetupTab } from './PhoneSetupTab';

const TABS = [
  { key: 'business', label: 'Business', icon: Building2 },
  { key: 'hours', label: 'Hours', icon: Clock },
  { key: 'ai', label: 'AI Receptionist', icon: Bot },
  { key: 'phone', label: 'Phone Setup', icon: PhoneForwarded },
] as const;

/**
 * Which section a bare `/settings` opens on.
 *
 * Phone setup is the one page here that can be *unfinished* rather than merely
 * unedited — until forwarding is verified the receptionist answers nothing — so
 * it is what someone arriving from the sidebar most likely came for. The other
 * tabs keep their own URLs and are unaffected.
 */
const DEFAULT_TAB = 'phone';

export function SettingsPage() {
  const { tab = DEFAULT_TAB } = useParams<{ tab: string }>();

  return (
    <div>
      <PageHeader title="Settings" description="Configure your company and AI receptionist." />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start lg:overflow-visible"
        >
          {TABS.map((item) => (
            // A plain `Link`, highlighted from the resolved tab rather than
            // from the router's own match.
            //
            // On a bare `/settings` no link's `to` equals the URL, so `NavLink`
            // considers all four inactive: the section actually on screen would
            // have no pill, and — because `NavLink` only emits `aria-current`
            // for a link it deems active — no `aria-current` either. That is
            // what the old `item.key === 'business'` special case was patching
            // around, and it would have needed patching again here. Driving
            // both the pill and `aria-current` off `tab` fixes both at once,
            // and the highlight can no longer disagree with the content below.
            <Link
              key={item.key}
              to={`/settings/${item.key}`}
              aria-current={tab === item.key ? 'page' : undefined}
              className={cn(
                'focus-ring flex h-10 shrink-0 items-center gap-2.5 px-3.5 text-body font-medium transition-colors duration-fast lg:w-full',
                tab === item.key
                  ? 'bg-accent-subtle text-accent'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'business' && <BusinessTab />}
          {tab === 'hours' && <HoursTab />}
          {tab === 'ai' && <AiTab />}
          {tab === 'phone' && <PhoneSetupTab />}
        </div>
      </div>
    </div>
  );
}

/**
 * The footer every settings form shares. It sits on the card's own gutter with
 * a divider above it, matching the wizard's step footer and CardFooter, so the
 * "save" affordance is in the same place and shape wherever it appears.
 */
function SaveBar({
  saving,
  saved,
  error,
  onCancel,
}: {
  saving: boolean;
  saved: boolean;
  error?: string;
  /** Supplied only by forms that can be left — the tabs that are always
      editable have nothing to cancel back to. */
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-subtle pt-5">
      {error && (
        <p className="mr-auto text-small text-emergency" role="alert">
          {error}
        </p>
      )}
      {saved && !saving && !error && (
        <p className="flex items-center gap-1 text-small text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Saved
        </p>
      )}
      {onCancel && (
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      )}
      <Button type="submit" loading={saving}>
        Save changes
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Business tab
// ---------------------------------------------------------------------------

/**
 * Company details as a profile that can be edited, rather than a form that is
 * always open.
 *
 * Landing straight in editable inputs made every visit look like unsaved work
 * and put a dozen live fields one stray tap away. The page now reads as an
 * account profile until someone explicitly chooses to change it; the edit form
 * below is the original one, unchanged, including its validation and save.
 */
function BusinessTab() {
  const company = useCompany();
  const update = useUpdateCompany();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [servicesText, setServicesText] = useState<string | null>(null);
  const [areasText, setAreasText] = useState<string | null>(null);

  if (company.isLoading || !company.data) return <LoadingBlock />;
  const data = company.data;

  const value = (field: string, fallback: string | null) => form[field] ?? fallback ?? '';
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Cancel discards by dropping the local edits, so the inputs fall back to
  // the server's values the next time they mount. `update.reset()` clears a
  // stale error or "Saved" flash from a previous attempt.
  const cancel = () => {
    setForm({});
    setServicesText(null);
    setAreasText(null);
    update.reset();
    setEditing(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      {
        name: value('name', data.name) || undefined,
        email: value('email', data.email) || undefined,
        phone: value('phone', data.phone) || undefined,
        website: value('website', data.website) || undefined,
        addressLine1: value('addressLine1', data.addressLine1) || undefined,
        city: value('city', data.city) || undefined,
        state: value('state', data.state) || undefined,
        postalCode: value('postalCode', data.postalCode) || undefined,
        timezone: value('timezone', data.timezone) || undefined,
        roofingServices: (servicesText ?? data.roofingServices.join('\n'))
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        serviceAreas: (areasText ?? data.serviceAreas.join('\n'))
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        emergencyPhone: value('emergencyPhone', data.emergencyPhone) || undefined,
        emergencyInstructions:
          value('emergencyInstructions', data.emergencyInstructions) || undefined,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (!editing) {
    const list = (items: string[]) => (items.length ? items.join(', ') : null);
    return (
      <Card className="gap-5 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h5 text-ink">Business details</h2>
            <p className="mt-0.5 text-small text-ink-muted">
              What your AI receptionist tells callers about you.
            </p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit details
          </Button>
        </div>
        <dl className="divide-y divide-line-subtle border-t border-line-subtle">
          <DetailRow label="Company name" value={data.name} />
          <DetailRow label="Business email" value={data.email} />
          <DetailRow label="Business phone" value={data.phone} />
          <DetailRow label="Website" value={data.website} />
          <DetailRow label="Address" value={data.addressLine1} />
          <DetailRow label="City" value={data.city} />
          <DetailRow label="State" value={data.state} />
          <DetailRow label="ZIP" value={data.postalCode} />
          <DetailRow label="Timezone" value={data.timezone} />
          <DetailRow label="Roofing services" value={list(data.roofingServices)} />
          <DetailRow label="Service areas" value={list(data.serviceAreas)} />
          <DetailRow label="Emergency phone" value={data.emergencyPhone} />
          <DetailRow label="Emergency instructions" value={data.emergencyInstructions} />
        </dl>
      </Card>
    );
  }

  return (
    <Card as="form" onSubmit={onSubmit} className="gap-5 px-6 py-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Company name" value={value('name', data.name)} onChange={set('name')} />
        <Input label="Business email" value={value('email', data.email)} onChange={set('email')} />
        <Input
          label="Business phone (your existing number)"
          value={value('phone', data.phone)}
          onChange={set('phone')}
        />
        <Input label="Website" value={value('website', data.website)} onChange={set('website')} />
        <Input
          label="Address"
          value={value('addressLine1', data.addressLine1)}
          onChange={set('addressLine1')}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="City" value={value('city', data.city)} onChange={set('city')} />
          <Input label="State" value={value('state', data.state)} onChange={set('state')} />
          <Input
            label="ZIP"
            value={value('postalCode', data.postalCode)}
            onChange={set('postalCode')}
          />
        </div>
      </div>
      <Input
        label="Timezone (IANA)"
        hint="e.g. America/Chicago — used for business hours and daily stats."
        value={value('timezone', data.timezone)}
        onChange={set('timezone')}
      />
      <Textarea
        label="Roofing services (one per line)"
        rows={4}
        value={servicesText ?? data.roofingServices.join('\n')}
        onChange={(e) => setServicesText(e.target.value)}
      />
      <Textarea
        label="Service areas (one per line)"
        rows={3}
        value={areasText ?? data.serviceAreas.join('\n')}
        onChange={(e) => setAreasText(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Emergency phone"
          value={value('emergencyPhone', data.emergencyPhone)}
          onChange={set('emergencyPhone')}
        />
      </div>
      <Textarea
        label="Emergency instructions for the AI"
        rows={3}
        value={value('emergencyInstructions', data.emergencyInstructions)}
        onChange={set('emergencyInstructions')}
      />
      <SaveBar
        saving={update.isPending}
        saved={update.isSuccess}
        error={update.isError ? (update.error as Error).message : undefined}
        onCancel={cancel}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Hours tab
// ---------------------------------------------------------------------------

/**
 * Native time pickers can't go through the `Input` component (they carry no
 * label and must stay inline), so they restate its declarations: same height,
 * radius, border and hover as every other control.
 */
const timeInputClass =
  'focus-ring h-10 border border-line bg-surface px-3 text-form-input text-ink transition-colors duration-fast ease-standard hover:border-line-strong';

const WEEK: BusinessHour[] = [
  { day: 'monday', open: '08:00', close: '18:00', closed: false },
  { day: 'tuesday', open: '08:00', close: '18:00', closed: false },
  { day: 'wednesday', open: '08:00', close: '18:00', closed: false },
  { day: 'thursday', open: '08:00', close: '18:00', closed: false },
  { day: 'friday', open: '08:00', close: '18:00', closed: false },
  { day: 'saturday', open: '09:00', close: '14:00', closed: false },
  { day: 'sunday', open: '00:00', close: '00:00', closed: true },
];

function HoursTab() {
  const company = useCompany();
  const save = useSetBusinessHours();
  const [hours, setHours] = useState<BusinessHour[] | null>(null);

  if (company.isLoading || !company.data) return <LoadingBlock />;
  const current = hours ?? (company.data.businessHours?.length ? company.data.businessHours : WEEK);

  const updateDay = (index: number, patch: Partial<BusinessHour>) => {
    setHours(current.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(current);
  };

  return (
    <Card as="form" onSubmit={onSubmit} className="gap-5 px-6 py-6">
      <p className="text-small text-ink-muted">
        The AI tells callers when you’re open and adjusts after-hours behavior.
      </p>
      <div className="space-y-2">
        {current.map((hour, index) => (
          <div
            key={hour.day}
            className="flex flex-wrap items-center gap-3 border border-line-subtle px-4 py-2.5 transition-colors duration-fast hover:border-line-strong"
          >
            <span className="w-24 shrink-0 text-body font-medium capitalize text-ink">
              {hour.day}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-small text-ink-muted">
              <Checkbox
                checked={!hour.closed}
                onChange={(e) => updateDay(index, { closed: !e.target.checked })}
              />
              Open
            </label>
            {!hour.closed && (
              <>
                <input
                  type="time"
                  value={hour.open}
                  onChange={(e) => updateDay(index, { open: e.target.value })}
                  className={timeInputClass}
                  aria-label={`${hour.day} opening time`}
                />
                <span className="text-small text-ink-faint">to</span>
                <input
                  type="time"
                  value={hour.close}
                  onChange={(e) => updateDay(index, { close: e.target.value })}
                  className={timeInputClass}
                  aria-label={`${hour.day} closing time`}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <SaveBar
        saving={save.isPending}
        saved={save.isSuccess}
        error={save.isError ? (save.error as Error).message : undefined}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AI tab
// ---------------------------------------------------------------------------

function AiTab() {
  const config = useAiConfig();
  const update = useUpdateAiConfig();
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  if (config.isLoading || !config.data) return <LoadingBlock />;
  const data = config.data;

  const str = (field: keyof typeof data, fallback: string | null) =>
    (form[field] as string | undefined) ?? fallback ?? '';
  const bool = (field: keyof typeof data, fallback: boolean) =>
    (form[field] as boolean | undefined) ?? fallback;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      assistantName: str('assistantName', data.assistantName),
      voice: str('voice', data.voice),
      greeting: str('greeting', data.greeting),
      persona: str('persona', data.persona),
      customInstructions: str('customInstructions', data.customInstructions) || undefined,
      captureLeads: bool('captureLeads', data.captureLeads),
      detectEmergencies: bool('detectEmergencies', data.detectEmergencies),
      requestAppointments: bool('requestAppointments', data.requestAppointments),
    });
  };

  const toggles: {
    field: 'captureLeads' | 'detectEmergencies' | 'requestAppointments';
    label: string;
    hint: string;
  }[] = [
    { field: 'captureLeads', label: 'Capture leads', hint: 'Collect caller contact details.' },
    {
      field: 'detectEmergencies',
      label: 'Detect emergencies',
      hint: 'Flag leaks and storm damage.',
    },
    {
      field: 'requestAppointments',
      label: 'Request appointments',
      hint: 'Offer to schedule visits.',
    },
  ];

  return (
    <Card as="form" onSubmit={onSubmit} className="gap-5 px-6 py-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Assistant name"
          value={str('assistantName', data.assistantName)}
          onChange={(e) => setForm((p) => ({ ...p, assistantName: e.target.value }))}
        />
        <Select
          label="Voice"
          value={str('voice', data.voice)}
          onChange={(e) => setForm((p) => ({ ...p, voice: e.target.value }))}
        >
          {Object.entries(AiVoice).map(([label, voice]) => (
            <option key={voice} value={voice}>
              {label.charAt(0) + label.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        label="Greeting"
        rows={2}
        value={str('greeting', data.greeting)}
        onChange={(e) => setForm((p) => ({ ...p, greeting: e.target.value }))}
      />
      <Input
        label="Personality"
        value={str('persona', data.persona)}
        onChange={(e) => setForm((p) => ({ ...p, persona: e.target.value }))}
      />
      <Textarea
        label="Custom instructions (optional)"
        rows={4}
        hint="Company-specific guidance, e.g. “Always mention our 10-year warranty.”"
        value={str('customInstructions', data.customInstructions)}
        onChange={(e) => setForm((p) => ({ ...p, customInstructions: e.target.value }))}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {toggles.map((toggle) => (
          <label
            key={toggle.field}
            className="flex cursor-pointer items-start gap-3 border border-line-subtle p-4 transition-colors duration-fast hover:border-line-strong"
          >
            <Checkbox
              className="mt-0.5"
              checked={bool(toggle.field, data[toggle.field])}
              onChange={(e) => setForm((p) => ({ ...p, [toggle.field]: e.target.checked }))}
            />
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink">{toggle.label}</span>
              <span className="block text-small text-ink-muted">{toggle.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <SaveBar
        saving={update.isPending}
        saved={update.isSuccess}
        error={update.isError ? (update.error as Error).message : undefined}
      />
    </Card>
  );
}
