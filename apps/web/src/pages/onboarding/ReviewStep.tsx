import { Link, useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { OnboardingStep } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useCompany } from '@/hooks/queries';
import { formatTimeRange } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { StepActions, StepError, StepHeading, StepLoading } from './fields';
import { useOnboarding } from './useOnboarding';

/** One reviewable section of the wizard's answers, with a link back to it. */
function ReviewSection({
  title,
  editTo,
  children,
}: {
  title: string;
  editTo: string;
  children: React.ReactNode;
}) {
  return (
    <Card as="section">
      <CardHeader className="items-center">
        <CardTitle as="h2">{title}</CardTitle>
        <Link
          to={editTo}
          className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          Edit
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardHeader>
      <dl className="divide-y divide-line-subtle border-t border-line-subtle px-6 py-2">
        {children}
      </dl>
    </Card>
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

  if (company.isLoading || config.isLoading) return <StepLoading />;

  const data = company.data;
  const openDays = (data?.businessHours ?? []).filter((hour) => !hour.closed);
  const [firstOpenDay] = openDays;

  return (
    <div className="space-y-8">
      <StepHeading
        title="Review your setup"
        blurb="Check everything over. You can change any of it later in Settings."
      />

      <div className="space-y-6">
        <ReviewSection title="Organization" editTo={stepPath(OnboardingStep.COMPANY)}>
          <DetailRow label="Business name" value={data?.name ?? ''} />
          <DetailRow label="Email" value={data?.email ?? ''} />
          <DetailRow label="Phone" value={data?.phone ?? ''} />
          <DetailRow
            label="Location"
            value={[data?.city, data?.state].filter(Boolean).join(', ')}
          />
        </ReviewSection>

        <ReviewSection title="Business details" editTo={stepPath(OnboardingStep.BUSINESS)}>
          <DetailRow label="Timezone" value={data?.timezone ?? ''} />
          <DetailRow label="Service areas" value={(data?.serviceAreas ?? []).join(', ')} />
          <DetailRow label="Services" value={(data?.roofingServices ?? []).join(', ')} />
          <DetailRow
            label="Open"
            value={
              firstOpenDay
                ? `${openDays.length} days a week, ${formatTimeRange(firstOpenDay.open, firstOpenDay.close)}`
                : 'No open days set'
            }
          />
          <DetailRow
            label="Emergency service"
            value={data?.emergencyServiceEnabled ? 'Enabled' : 'Not offered'}
          />
        </ReviewSection>

        <ReviewSection title="AI receptionist" editTo={stepPath(OnboardingStep.AI)}>
          <DetailRow label="Name" value={config.data?.assistantName ?? ''} />
          <DetailRow label="Voice" value={config.data?.voice ?? ''} />
          <DetailRow label="Greeting" value={config.data?.greeting ?? ''} />
          <DetailRow
            label="Transfers to a person"
            value={config.data?.transferToHuman ? (config.data.transferPhone ?? 'Yes') : 'No'}
          />
        </ReviewSection>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <p className="text-body text-ink-muted">
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
