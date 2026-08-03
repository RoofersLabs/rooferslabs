import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Sparkles } from 'lucide-react';
import { OnboardingStep } from '@rooferslabs/shared';
import { stepPath } from '@/auth/stages';
import { useAiConfig, useCompany } from '@/hooks/queries';
import { formatTimeRange } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { VOICE_NAMES } from './AiStep';
import { StepActions, StepError, StepHeading, StepLoading } from './fields';
import { useOnboarding } from './useOnboarding';

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
      className="animate-rise-in rounded-2xl shadow-md"
      style={{ animationDelay: `${80 + index * 70}ms` }}
    >
      <CardHeader className="items-center px-6 sm:px-8">
        <CardTitle as="h2">{title}</CardTitle>
        <Link
          to={editTo}
          className="focus-ring -mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-small font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-surface-3 hover:text-accent"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
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
 * Deliberately read-only: it writes nothing of its own, it only finalises, which
 * keeps every tenant-scoped write in the wizard inside `/companies`.
 */
export function ReviewStep() {
  const navigate = useNavigate();
  const { advanceFrom, isSaving, error } = useOnboarding();
  const company = useCompany();
  const config = useAiConfig();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The stage flips to `app` once the session reports COMPLETE; the route
    // guard performs the navigation, so there is none here.
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
        className="animate-rise-in gap-6 rounded-2xl p-6 shadow-md [animation-delay:290ms] sm:p-8"
      >
        <div className="flex items-start gap-4">
          <IconTile icon={Sparkles} tone="brand" size="md" shape="square" />
          <div className="min-w-0">
            <p className="text-h5 text-ink">You’re all set</p>
            <p className="mt-1 text-body text-ink-muted">
              Finishing setup takes you straight to your dashboard.
            </p>
          </div>
        </div>
        <StepError error={error} />
        <StepActions
          submitting={isSaving}
          submitLabel="Finish setup"
          onBack={() => navigate(stepPath(OnboardingStep.AI))}
        />
      </Card>
    </div>
  );
}
