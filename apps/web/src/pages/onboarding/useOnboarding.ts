import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingStep } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { nextStep, resumeStep, stepIndex, stepPath, type WizardStep } from '@/auth/stages';
import { useCompleteOnboarding, useSetOnboardingStep } from '@/hooks/queries';

/**
 * What `advanceFrom` tells the next screen about how it was reached.
 *
 * The wizard's guard asks whether a step has been unlocked, and it learns that
 * from the session query. `setQueryData` updates the cache synchronously but
 * React Query notifies its subscribers on a later tick, so for one render after
 * `navigate()` the guard is still looking at the previous step — it judged the
 * step just persisted to be unreachable and redirected back to the one the user
 * came from. That is the whole of the "click Next twice" bug: the first click
 * did all its work and was then undone by a guard reading one-render-old state.
 *
 * Writing the cache earlier cannot fix it, because the ordering is React's, not
 * the cache's. Carrying the fact on the navigation can: the location and its
 * state arrive in the same update, so the guard sees them together. It is also
 * the honest statement of the invariant — the server has already accepted this
 * step, so this particular navigation needs no second opinion. A deep link
 * carries no such state and is still checked.
 */
export interface OnboardingNavState {
  unlockedStep?: WizardStep;
}

export interface OnboardingProgress {
  /** The furthest step the tenant has unlocked, read from the server. */
  furthest: WizardStep;
  /** Whether `step` may be opened — reached steps only, never a skip ahead. */
  canOpen: (step: WizardStep) => boolean;
  /**
   * Persist completion of `step` and move on. Advancing is server-side
   * (`PATCH /companies/me/onboarding`), so progress survives a reload, a new
   * device, or an abandoned session. The final step completes onboarding.
   */
  advanceFrom: (step: WizardStep) => Promise<void>;
  isSaving: boolean;
  /** Failure from persisting progress or completing setup, for the step to render. */
  error: Error | null;
}

/**
 * Wizard progress, backed by `company.onboardingStep` rather than local state.
 *
 * Advancing only ever moves forward: revisiting an earlier step to edit it must
 * not rewind the tenant's furthest position, or a user correcting a typo in
 * step 1 would be forced to walk through the wizard again.
 */
export function useOnboarding(): OnboardingProgress {
  const { onboardingStep } = useAccess();
  const navigate = useNavigate();
  const setStep = useSetOnboardingStep();
  const complete = useCompleteOnboarding();

  const furthest = resumeStep(onboardingStep);

  const canOpen = useCallback(
    (step: WizardStep) => stepIndex(step) <= stepIndex(furthest),
    [furthest],
  );

  const advanceFrom = useCallback(
    async (step: WizardStep) => {
      const next = nextStep(step);

      if (!next) {
        // Last step: finish setup. The stage flips to `app` when the refreshed
        // session reports COMPLETE, and the guard does the routing.
        await complete.mutateAsync();
        return;
      }

      // Only persist forward progress; editing step 1 later must not rewind.
      if (stepIndex(next) > stepIndex(furthest)) {
        await setStep.mutateAsync(next);
      }
      // The step is persisted, so this navigation is authorised by definition.
      // Saying so in the router state is what makes it survive the guard: see
      // `OnboardingNavState`.
      navigate(stepPath(next), { state: { unlockedStep: next } satisfies OnboardingNavState });
    },
    [complete, furthest, navigate, setStep],
  );

  return {
    furthest,
    canOpen,
    advanceFrom,
    isSaving: setStep.isPending || complete.isPending,
    error: (complete.error ?? setStep.error) as Error | null,
  };
}

/** Display metadata for the stepper. */
export const STEP_LABELS: Record<WizardStep, string> = {
  [OnboardingStep.COMPANY]: 'Organization',
  [OnboardingStep.BUSINESS]: 'Business details',
  [OnboardingStep.AI]: 'AI receptionist',
  [OnboardingStep.KNOWLEDGE]: 'Review',
};
