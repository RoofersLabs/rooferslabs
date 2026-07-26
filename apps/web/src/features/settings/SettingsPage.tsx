import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Building2, Clock, Bot, PhoneForwarded, Palette, CheckCircle2 } from 'lucide-react';
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
import { Input, Select, Textarea } from '@/components/ui/input';
import { LoadingBlock } from '@/components/ui/spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PhoneSetupTab } from './PhoneSetupTab';

const TABS = [
  { key: 'business', label: 'Business', icon: Building2 },
  { key: 'hours', label: 'Hours', icon: Clock },
  { key: 'ai', label: 'AI Receptionist', icon: Bot },
  { key: 'phone', label: 'Phone Setup', icon: PhoneForwarded },
  { key: 'branding', label: 'Branding', icon: Palette },
] as const;

export function SettingsPage() {
  const { tab = 'business' } = useParams<{ tab: string }>();

  return (
    <div>
      <PageHeader title="Settings" description="Configure your company and AI receptionist." />

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:self-start lg:overflow-visible"
        >
          {TABS.map((item) => (
            <NavLink
              key={item.key}
              to={`/settings/${item.key}`}
              className={({ isActive }) =>
                cn(
                  'focus-ring flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-body font-medium transition-colors duration-fast lg:w-full',
                  isActive || (item.key === 'business' && tab === 'business')
                    ? 'bg-accent-subtle text-accent'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'business' && <BusinessTab />}
          {tab === 'hours' && <HoursTab />}
          {tab === 'ai' && <AiTab />}
          {tab === 'phone' && <PhoneSetupTab />}
          {tab === 'branding' && <BrandingTab />}
        </div>
      </div>
    </div>
  );
}

function SaveBar({ saving, saved, error }: { saving: boolean; saved: boolean; error?: string }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {error && <p className="text-small text-emergency">{error}</p>}
      {saved && !saving && !error && (
        <p className="flex items-center gap-1 text-small text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Saved
        </p>
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

function BusinessTab() {
  const company = useCompany();
  const update = useUpdateCompany();
  const [form, setForm] = useState<Record<string, string>>({});
  const [servicesText, setServicesText] = useState<string | null>(null);
  const [areasText, setAreasText] = useState<string | null>(null);

  if (company.isLoading || !company.data) return <LoadingBlock />;
  const data = company.data;

  const value = (field: string, fallback: string | null) => form[field] ?? fallback ?? '';
  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
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
    });
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
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
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Hours tab
// ---------------------------------------------------------------------------

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
    <form onSubmit={onSubmit} className="card space-y-4 p-6">
      <p className="text-small text-ink-muted">
        The AI tells callers when you’re open and adjusts after-hours behavior.
      </p>
      <div className="space-y-2">
        {current.map((hour, index) => (
          <div
            key={hour.day}
            className="flex items-center gap-3 rounded-lg border border-line-subtle px-4 py-2.5 transition-colors duration-fast hover:border-line-strong"
          >
            <span className="w-24 text-body font-medium capitalize text-ink">{hour.day}</span>
            <label className="flex items-center gap-2 text-small text-ink-muted">
              <input
                type="checkbox"
                checked={!hour.closed}
                onChange={(e) => updateDay(index, { closed: !e.target.checked })}
                className="focus-ring h-4 w-4 rounded border-line text-accent"
              />
              Open
            </label>
            {!hour.closed && (
              <>
                <input
                  type="time"
                  value={hour.open}
                  onChange={(e) => updateDay(index, { open: e.target.value })}
                  className="focus-ring rounded-lg border border-line px-2 py-1.5 text-form-input text-ink"
                  aria-label={`${hour.day} opening time`}
                />
                <span className="text-caption text-ink-faint">to</span>
                <input
                  type="time"
                  value={hour.close}
                  onChange={(e) => updateDay(index, { close: e.target.value })}
                  className="focus-ring rounded-lg border border-line px-2 py-1.5 text-form-input text-ink"
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
    </form>
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
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
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
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-subtle p-4 transition-colors duration-fast hover:border-line-strong"
          >
            <input
              type="checkbox"
              checked={bool(toggle.field, data[toggle.field])}
              onChange={(e) => setForm((p) => ({ ...p, [toggle.field]: e.target.checked }))}
              className="focus-ring mt-0.5 h-4 w-4 rounded border-line text-accent"
            />
            <span>
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
    </form>
  );
}

// ---------------------------------------------------------------------------
// Branding tab
// ---------------------------------------------------------------------------

function BrandingTab() {
  const company = useCompany();
  const update = useUpdateCompany();
  const [primary, setPrimary] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  if (company.isLoading || !company.data) return <LoadingBlock />;
  const data = company.data;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      primaryColor: primary ?? data.primaryColor ?? undefined,
      logoUrl: (logoUrl ?? data.logoUrl) || undefined,
    });
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <div className="flex items-center gap-4">
        <div>
          <label htmlFor="brand-color" className="block text-body font-medium text-ink">
            Primary brand color
          </label>
          <input
            id="brand-color"
            type="color"
            value={primary ?? data.primaryColor ?? '#0E3996'}
            onChange={(e) => setPrimary(e.target.value)}
            className="focus-ring mt-1.5 h-10 w-20 cursor-pointer rounded-lg border border-line"
          />
        </div>
      </div>
      <Input
        label="Logo URL"
        hint="Direct link to your logo image (uploads to S3 arrive in a later release)."
        value={logoUrl ?? data.logoUrl ?? ''}
        onChange={(e) => setLogoUrl(e.target.value)}
      />
      <SaveBar
        saving={update.isPending}
        saved={update.isSuccess}
        error={update.isError ? (update.error as Error).message : undefined}
      />
    </form>
  );
}
