import { Navigate, useParams } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
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
 * Progress rail.
 *
 * Four numbered chips wrapped onto two lines on a phone and cost more vertical
 * space than the first question of the form. This says the same thing in one
 * line of type and a 3px rule: a caption naming the position and the step, over
 * a segment per step. Nothing here competes with the heading below it.
 *
 * Three states, and none of them is signalled by colour alone — the caption
 * states the position in words, and each segment carries its own text for a
 * screen reader. A segment already visited but stepped back from keeps a pale
 * fill, so returning to step 1 to fix a typo does not read as having lost the
 * work behind it.
 *
 * The fill is a scaled child rather than an animated width: transform stays on
 * the compositor, so advancing a step costs no layout.
 */
function Stepper({ current, furthestIndex }: { current: WizardStep; furthestIndex: number }) {
  const currentIndex = stepIndex(current);
  return (
    <nav aria-label="Setup progress" className="mb-8 sm:mb-10">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-caption font-medium uppercase tracking-[0.08em] text-ink-faint">
          Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <p className="truncate text-caption font-medium text-ink-muted">{STEP_LABELS[current]}</p>
      </div>

      <ol className="mt-3 flex gap-1.5">
        {ONBOARDING_STEPS.map((step, index) => {
          const state =
            index <= currentIndex ? 'current' : index <= furthestIndex ? 'visited' : 'upcoming';
          return (
            <li
              key={step}
              className="flex-1"
              aria-current={index === currentIndex ? 'step' : undefined}
            >
              <span className="sr-only">
                {STEP_LABELS[step]} —{' '}
                {index < currentIndex
                  ? 'completed'
                  : index === currentIndex
                    ? 'current step'
                    : state === 'visited'
                      ? 'completed, revisit later'
                      : 'not started'}
              </span>
              <span aria-hidden className="block h-[3px] rounded-full bg-line">
                <span
                  style={{ transitionDelay: `${index * 60}ms` }}
                  className={cn(
                    'motion-safe-fill block h-full origin-left rounded-full transition-transform duration-slow ease-decelerate',
                    state === 'upcoming' ? 'scale-x-0' : 'scale-x-100',
                    state === 'visited' ? 'bg-accent-border' : 'bg-accent',
                  )}
                />
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
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
      <Stepper current={step} furthestIndex={stepIndex(furthest)} />
      <StepScreen />
    </StandaloneLayout>
  );
}
