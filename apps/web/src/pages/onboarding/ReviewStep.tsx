import { Link, useNavigate } from 'react-router-dom';
import { OnboardingStep } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useCompany } from '@/hooks/queries';
import { formatTimeRange } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { VOICE_NAMES } from './AiStep';
import { StepActions, StepError, StepHeading, StepLoading } from './fields';
import { useOnboarding } from './useOnboarding';
import { PencilIcon, SparklesIcon } from '@heroicons/react/24/outline';

/**
 * One reviewable section of the wizard's answers, with a link back to it.
 *
 * The sections share the step sheet's corners and elevation, and arrive one
 * after another rather than all at once — enough sequencing to make the page
 * feel assembled, not enough to make anyone wait for it.
 */
function ReviewSection({
  title,
  editTo,
  index,
  children,
}: {
  title: string;
  editTo: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      as="section"
      className="animate-rise-in shadow-md"
      style={{ animationDelay: `${80 + index * 70}ms` }}
    >
      <CardHeader className="items-center px-6 sm:px-8">
        <CardTitle as="h2">{title}</CardTitle>
        <Link
          to={editTo}
          className="focus-ring -mr-2 inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-small font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-surface-3 hover:text-accent"
        >
          <PencilIcon className="h-4 w-4" aria-hidden />
          Edit
          <span className="sr-only"> {title}</span>
        </Link>
      </CardHeader>
      <dl className="divide-y divide-line-subtle border-t border-line-subtle px-6 py-2 sm:px-8">
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
    // The stage flips to `approval` once the session reports COMPLETE and
    // PENDING_APPROVAL; the route guard performs the navigation, so there is
    // none here.
    await advanceFrom(OnboardingStep.KNOWLEDGE);
  };

  if (company.isLoading || config.isLoading) return <StepLoading />;

  const data = company.data;
  const openDays = (data?.businessHours ?? []).filter((hour) => !hour.closed);
  const [firstOpenDay] = openDays;
  const voice = config.data?.voice ?? '';

  return (
    <div className="space-y-8 sm:space-y-10">
      <StepHeading
        title="Review your setup"
        blurb="Check everything over. You can change any of it later in Settings."
      />

      <div className="space-y-5">
        <ReviewSection title="Organization" editTo={stepPath(OnboardingStep.COMPANY)} index={0}>
          <DetailRow label="Business name" value={data?.name ?? ''} />
          <DetailRow label="Email" value={data?.email ?? ''} />
          <DetailRow label="Phone" value={data?.phone ?? ''} />
          <DetailRow
            label="Location"
            value={[data?.city, data?.state].filter(Boolean).join(', ')}
          />
        </ReviewSection>

        <ReviewSection
          title="Business details"
          editTo={stepPath(OnboardingStep.BUSINESS)}
          index={1}
        >
          <DetailRow label="Timezone" value={data?.timezone ?? ''} />
          <DetailRow label="Service areas" value={(data?.serviceAreas ?? []).join(', ')} wrap />
          <DetailRow label="Services" value={(data?.roofingServices ?? []).join(', ')} wrap />
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

        <ReviewSection title="AI receptionist" editTo={stepPath(OnboardingStep.AI)} index={2}>
          <DetailRow label="Name" value={config.data?.assistantName ?? ''} />
          <DetailRow label="Voice" value={VOICE_NAMES[voice] ?? voice} />
          {/* The greeting is a sentence, and one the user is here to approve —
              it must be readable to the end rather than cut off at the gutter. */}
          <DetailRow label="Greeting" value={config.data?.greeting ?? ''} wrap />
          <DetailRow
            label="Transfers to a person"
            value={config.data?.transferToHuman ? (config.data.transferPhone ?? 'Yes') : 'No'}
          />
        </ReviewSection>
      </div>

      {/* The last thing on the last screen: what finishing actually does, and
          the button that does it, on one sheet rather than loose on the page. */}
      <Card
        as="form"
        onSubmit={onSubmit}
        className="animate-rise-in gap-6 p-6 shadow-md [animation-delay:290ms] sm:p-8"
      >
        <div className="flex items-start gap-4">
          <IconTile icon={SparklesIcon} tone="brand" size="md" />
          <div className="min-w-0">
            <p className="text-h5 text-ink">You’re all set</p>
            {/* What actually happens next, said before the click rather than
                discovered after it. Finishing setup no longer opens the product
                — it submits the account for approval — and a button that
                promised a dashboard would be making a promise it cannot keep. */}
            <p className="mt-1 text-body text-ink-muted">
              Finishing setup submits your account for approval. Our team reviews it and you’ll get
              access as soon as it’s approved
              {paymentsEnabled ? ', where you’ll choose a plan to go live.' : '.'}
            </p>
          </div>
        </div>
        <StepError error={error} />
        <StepActions
          submitting={isSaving}
          submitLabel="Finish setup & request access"
          onBack={() => navigate(stepPath(OnboardingStep.AI))}
        />
      </Card>
    </div>
  );
}
