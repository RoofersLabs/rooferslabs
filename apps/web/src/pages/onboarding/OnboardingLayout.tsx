import { Navigate, useParams } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Check } from 'lucide-react';
import { OnboardingStep } from '@rooferslabs/shared';
import { cn } from '@/lib/utils';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import {
  ONBOARDING_STEPS,
  SLUG_TO_STEP,
  stepIndex,
  stepPath,
  type WizardStep,
} from '@/auth/stages';
import { AiStep } from './AiStep';
import { BusinessStep } from './BusinessStep';
import { CompanyStep } from './CompanyStep';
import { ReviewStep } from './ReviewStep';
import { STEP_LABELS, useOnboarding } from './useOnboarding';

const STEP_SCREENS: Record<WizardStep, () => JSX.Element> = {
  [OnboardingStep.COMPANY]: CompanyStep,
  [OnboardingStep.BUSINESS]: BusinessStep,
  [OnboardingStep.AI]: AiStep,
  [OnboardingStep.KNOWLEDGE]: ReviewStep,
};

/**
 * Numbered progress rail.
 *
 * Three states, each carrying its own shape as well as its own colour: a
 * completed step is a filled tick, the current step is a filled number, and an
 * upcoming step is an outline. Colour alone never distinguishes them.
 */
function Stepper({ currentIndex, furthestIndex }: { currentIndex: number; furthestIndex: number }) {
  return (
    <ol className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-3">
      {ONBOARDING_STEPS.map((step, index) => {
        const state =
          index === currentIndex ? 'current' : index < furthestIndex ? 'done' : 'upcoming';
        return (
          <li key={step} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={cn(
                'font-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold transition-colors duration-base ease-standard',
                state === 'upcoming'
                  ? 'border border-line text-ink-faint'
                  : state === 'done'
                    ? 'bg-success text-ink-on-brand'
                    : 'bg-accent text-ink-on-brand',
              )}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-small transition-colors duration-base ease-standard',
                state === 'current'
                  ? 'font-semibold text-ink'
                  : state === 'done'
                    ? 'font-medium text-ink-muted'
                    : 'text-ink-faint',
              )}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {STEP_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Chrome and step-ordering for the wizard.
 *
 * The stage guard has already established that this visitor belongs in
 * onboarding; this only decides *which* step, and renders it directly rather
 * than through an `<Outlet>` so the stepper and the form can never disagree
 * about which step is showing.
 *
 * Both redirects below target `stepPath(furthest)`, which is openable by
 * definition (`stepIndex(furthest) <= stepIndex(furthest)`), so neither loops.
 */
export function OnboardingLayout() {
  const { step: slug } = useParams();
  const { furthest, canOpen } = useOnboarding();

  // Bare /onboarding, or an unrecognised slug: resume where the server says we
  // are. This is what makes a reload, a new device, or a bookmarked deep link
  // land on the right step.
  const step = slug ? SLUG_TO_STEP[slug] : undefined;
  if (!step) return <Navigate to={stepPath(furthest)} replace />;

  // A deep link to a step that has not been unlocked yet.
  if (!canOpen(step)) return <Navigate to={stepPath(furthest)} replace />;

  const StepScreen = STEP_SCREENS[step];

  return (
    <StandaloneLayout action={<UserButton />}>
      <Stepper currentIndex={stepIndex(step)} furthestIndex={stepIndex(furthest)} />
      <StepScreen />
    </StandaloneLayout>
  );
}
