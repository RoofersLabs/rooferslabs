import { cn, formatPhone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PhoneArrowUpRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { aiConfig, businessHours, businessProfile, phoneSetup } from '../data';
import { Reveal } from '../animation';
import { PreviewPageHeader } from '../chrome';
import { usePhone, useWide } from '../formFactor';

/**
 * Settings, matching `features/settings/SettingsPage`: the section rail beside
 * the section, and the same four sections the product ships — Business, Hours,
 * AI Receptionist and Phone Setup.
 *
 * Four, not six. Integrations does not exist in the product, and Billing is a
 * standalone page outside the application shell rather than a settings section;
 * drawing either here would be showing a visitor a screen they will not find
 * after signing up, which is the one thing a product demo must never do.
 *
 * The save is the product's own: `SaveBar`'s inline "Saved", on the card's
 * gutter with a divider above it. The application has no toast system — every
 * confirmation in it is inline, next to the control that caused it — so a toast
 * would have had to be invented for the marketing page and then never seen
 * again.
 */

export type SettingsTab = 'business' | 'hours' | 'ai' | 'phone';

const TABS = [
  { key: 'business', label: 'Business', icon: BuildingOffice2Icon },
  { key: 'hours', label: 'Hours', icon: ClockIcon },
  { key: 'ai', label: 'AI Receptionist', icon: CpuChipIcon },
  { key: 'phone', label: 'Phone Setup', icon: PhoneArrowUpRightIcon },
] as const;

export function SettingsView({
  tab,
  onTab,
  voice,
  save = 'idle',
}: {
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  /** The one field the demo edits, so the change and the save are the same change. */
  voice: string;
  save?: 'idle' | 'saving' | 'saved';
}) {
  const wide = useWide();

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Settings"
          description="Configure your company and AI receptionist."
        />
      </Reveal>

      {/* `lg:grid-cols-[220px_1fr]`, as the page has it: the section rail
          only stands beside the panel once there is a desk's width for both.
          Below that the tabs are a row above the panel — which is also what an
          iPad in portrait gets, and it is what stopped the rail from taking
          220px of an 834pt screen away from the fields. */}
      <div className={cn('grid gap-6', wide && 'grid-cols-[220px_1fr]')}>
        <Reveal index={1}>
          <nav
            aria-label="Settings sections"
            className={cn('flex gap-1', wide ? 'flex-col' : 'overflow-x-auto')}
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                data-demo-target={`settings:${item.key}`}
                aria-current={tab === item.key ? 'page' : undefined}
                className={cn(
                  'focus-ring flex h-10 shrink-0 items-center gap-2.5 px-3.5 text-body font-medium transition-colors duration-fast',
                  wide && 'w-full',
                  tab === item.key
                    ? 'bg-accent-subtle text-accent'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </button>
            ))}
          </nav>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          {tab === 'business' && <BusinessSection />}
          {tab === 'hours' && <HoursSection save={save} />}
          {tab === 'ai' && <AiSection voice={voice} save={save} />}
          {tab === 'phone' && <PhoneSection />}
        </Reveal>
      </div>
    </div>
  );
}

/** The footer every settings form shares, matching `SaveBar`. */
function SaveBar({ save }: { save: 'idle' | 'saving' | 'saved' }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-subtle pt-5">
      {save === 'saved' && (
        <p className="flex items-center gap-1 text-small text-success">
          <CheckCircleIcon className="h-4 w-4" aria-hidden />
          Saved
        </p>
      )}
      <Button type="button" data-demo-target="settings:save" loading={save === 'saving'}>
        Save changes
      </Button>
    </div>
  );
}

function BusinessSection() {
  return (
    <Card className="gap-5 px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-h5 text-ink">Business details</h4>
          <p className="mt-0.5 text-small text-ink-muted">
            What your AI receptionist tells callers about you.
          </p>
        </div>
        <Button variant="secondary" className="shrink-0">
          <PencilIcon className="h-4 w-4" aria-hidden />
          Edit details
        </Button>
      </div>
      <dl className="divide-y divide-line-subtle border-t border-line-subtle">
        {businessProfile.map(([label, value]) => (
          <DetailRow key={label} label={label} value={value} />
        ))}
      </dl>
    </Card>
  );
}

function HoursSection({ save }: { save: 'idle' | 'saving' | 'saved' }) {
  return (
    <Card className="gap-5 px-6 py-6">
      <p className="text-small text-ink-muted">
        The AI tells callers when you’re open and adjusts after-hours behavior.
      </p>
      <div className="space-y-2">
        {businessHours.map((hour) => (
          <div
            key={hour.day}
            className="flex flex-wrap items-center gap-3 border border-line-subtle px-4 py-2.5 transition-colors duration-fast hover:border-line-strong"
          >
            <span className="w-24 shrink-0 text-body font-medium capitalize text-ink">
              {hour.day}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-small text-ink-muted">
              <Checkbox checked={!hour.closed} readOnly />
              Open
            </label>
            {!hour.closed && (
              <span className="font-num flex items-center gap-2 text-small text-ink">
                <span className="flex h-10 items-center border border-line bg-surface px-3">
                  {hour.open}
                </span>
                <span className="text-ink-faint">to</span>
                <span className="flex h-10 items-center border border-line bg-surface px-3">
                  {hour.close}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      <SaveBar save={save} />
    </Card>
  );
}

function AiSection({ voice, save }: { voice: string; save: 'idle' | 'saving' | 'saved' }) {
  const phone = usePhone();

  return (
    <Card className="gap-5 px-6 py-6">
      <div className={cn('grid gap-4', !phone && 'grid-cols-2')}>
        <Input label="Assistant name" value={aiConfig.assistantName} readOnly />
        <Select
          label="Voice"
          value={voice}
          onChange={() => undefined}
          data-demo-target="field:voice"
        >
          {['Ember', 'Aurora', 'Rowan', 'Sage'].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      <Textarea label="Greeting" rows={2} value={aiConfig.greeting} readOnly />
      <Input label="Personality" value={aiConfig.persona} readOnly />
      <Textarea
        label="Custom instructions (optional)"
        rows={3}
        hint="Company-specific guidance, e.g. “Always mention our 10-year warranty.”"
        value={aiConfig.instructions}
        readOnly
      />
      <div className={cn('grid gap-3', !phone && 'grid-cols-3')}>
        {aiConfig.toggles.map((toggle) => (
          <label
            key={toggle.label}
            className="flex cursor-pointer items-start gap-3 border border-line-subtle p-4 transition-colors duration-fast hover:border-line-strong"
          >
            <Checkbox className="mt-0.5" checked={toggle.on} readOnly />
            <span className="min-w-0">
              <span className="block text-body font-medium text-ink">{toggle.label}</span>
              <span className="block text-small text-ink-muted">{toggle.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <SaveBar save={save} />
    </Card>
  );
}

function PhoneSection() {
  const phone = usePhone();

  return (
    <div className="space-y-4">
      <Card className="px-6 py-6">
        <h4 className="text-h5 text-ink">AI Receptionist</h4>
        <p className="mt-1 text-small text-ink-muted">
          Answering forwarded calls, capturing leads, and updating your dashboard.
        </p>
        <dl className={cn('mt-5 grid gap-x-8 gap-y-3 text-small', !phone && 'grid-cols-2')}>
          <div>
            <dt className="text-caption text-ink-muted">Business Phone Number</dt>
            <dd className="font-num mt-0.5 font-medium text-ink">
              {formatPhone(phoneSetup.businessNumber)}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">AI Receptionist Number</dt>
            <dd className="font-num mt-0.5 font-medium text-ink">
              {formatPhone(phoneSetup.aiNumber)}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Carrier</dt>
            <dd className="mt-0.5 font-medium text-ink">{phoneSetup.carrier}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Forwarding Status</dt>
            <dd className="mt-0.5 font-medium text-success">Verified</dd>
          </div>
        </dl>
      </Card>

      <Card className="px-6 py-6">
        <p className="mb-1.5 text-caption uppercase tracking-wider text-accent">Step 1 of 3</p>
        <h4 className="text-h5 text-ink">Your AI Receptionist Number</h4>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-num border border-accent-border bg-accent-subtle px-5 py-2.5 text-h4 text-accent">
            {formatPhone(phoneSetup.aiNumber)}
          </span>
          <Button variant="secondary">
            <DocumentDuplicateIcon className="h-4 w-4" aria-hidden />
            Copy
          </Button>
          <Badge tone="success">
            <ShieldCheckIcon className="h-4 w-4" aria-hidden />
            AI Receptionist Active
          </Badge>
        </div>
        <p className="mt-3 text-small text-ink-muted">
          Calls to your business number are answered by your AI receptionist.
        </p>
      </Card>
    </div>
  );
}
