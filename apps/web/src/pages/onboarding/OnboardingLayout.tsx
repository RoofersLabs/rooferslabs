import { Navigate, useParams } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { OnboardingStep } from '@rooferslabs/shared';
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

/** Numbered progress rail. */
function Stepper({ currentIndex, furthestIndex }: { currentIndex: number; furthestIndex: number }) {
  return (
    <ol className="mb-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {ONBOARDING_STEPS.map((step, index) => {
        const state =
          index === currentIndex ? 'current' : index < furthestIndex ? 'done' : 'upcoming';
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                state === 'upcoming'
                  ? 'flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-400'
                  : 'flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white'
              }
            >
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span
              className={
                state === 'current'
                  ? 'font-medium text-gray-900'
                  : state === 'done'
                    ? 'text-gray-600'
                    : 'text-gray-400'
              }
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <span className="font-bold">RoofersLabs</span>
          <UserButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <Stepper currentIndex={stepIndex(step)} furthestIndex={stepIndex(furthest)} />
        <StepScreen />
      </main>
    </div>
  );
}
