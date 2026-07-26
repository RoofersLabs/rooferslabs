import { Link, useNavigate } from 'react-router-dom';
import { OnboardingStep } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useCompany } from '@/hooks/queries';
import { formatTimeRange } from '@/lib/utils';
import { StepActions, StepError, StepHeading } from './fields';
import { useOnboarding } from './useOnboarding';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-1.5 text-sm">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function Card({
  title,
  editTo,
  children,
}: {
  title: string;
  editTo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-gray-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link to={editTo} className="text-sm underline">
          Edit
        </Link>
      </div>
      <dl className="mt-3 divide-y divide-gray-100">{children}</dl>
    </section>
  );
}

/**
 * Step 4 — review and confirm.
 *
 * Deliberately read-only: it writes nothing of its own, it only finalises. That
 * keeps every tenant-scoped write in the wizard inside `/companies`, so the
 * payment wall stays closed around the rest of the API while setup runs.
 */
export function ReviewStep() {
  const navigate = useNavigate();
  const { paymentsEnabled } = useAccess();
  const { advanceFrom, isSaving, error } = useOnboarding();
  const company = useCompany();
  const config = useAiConfig();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The stage flips to `payment` once the session reports COMPLETE; the
    // route guard performs the navigation, so there is none here.
    await advanceFrom(OnboardingStep.KNOWLEDGE);
  };

  if (company.isLoading || config.isLoading) {
    return <p className="text-sm text-gray-600">Loading…</p>;
  }

  const data = company.data;
  const openDays = (data?.businessHours ?? []).filter((hour) => !hour.closed);
  const [firstOpenDay] = openDays;

  return (
    <div className="space-y-8">
      <StepHeading
        title="Review your setup"
        blurb="Check everything over. You can change any of it later in Settings."
      />

      <div className="space-y-4">
        <Card title="Organization" editTo={stepPath(OnboardingStep.COMPANY)}>
          <Row label="Business name" value={data?.name ?? ''} />
          <Row label="Email" value={data?.email ?? ''} />
          <Row label="Phone" value={data?.phone ?? ''} />
          <Row label="Location" value={[data?.city, data?.state].filter(Boolean).join(', ')} />
        </Card>

        <Card title="Business details" editTo={stepPath(OnboardingStep.BUSINESS)}>
          <Row label="Timezone" value={data?.timezone ?? ''} />
          <Row label="Service areas" value={(data?.serviceAreas ?? []).join(', ')} />
          <Row label="Services" value={(data?.roofingServices ?? []).join(', ')} />
          <Row
            label="Open"
            value={
              firstOpenDay
                ? `${openDays.length} days a week, ${formatTimeRange(firstOpenDay.open, firstOpenDay.close)}`
                : 'No open days set'
            }
          />
          <Row
            label="Emergency service"
            value={data?.emergencyServiceEnabled ? 'Enabled' : 'Not offered'}
          />
        </Card>

        <Card title="AI receptionist" editTo={stepPath(OnboardingStep.AI)}>
          <Row label="Name" value={config.data?.assistantName ?? ''} />
          <Row label="Voice" value={config.data?.voice ?? ''} />
          <Row label="Greeting" value={config.data?.greeting ?? ''} />
          <Row
            label="Transfers to a person"
            value={config.data?.transferToHuman ? (config.data.transferPhone ?? 'Yes') : 'No'}
          />
        </Card>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {paymentsEnabled
            ? 'Finishing setup takes you to plan selection. Your receptionist goes live once your subscription is active.'
            : 'Finishing setup takes you straight to your dashboard.'}
        </p>
        <StepError error={error} />
        <StepActions
          submitting={isSaving}
          submitLabel={paymentsEnabled ? 'Finish setup & choose a plan' : 'Finish setup'}
          onBack={() => navigate(stepPath(OnboardingStep.AI))}
        />
      </form>
    </div>
  );
}
