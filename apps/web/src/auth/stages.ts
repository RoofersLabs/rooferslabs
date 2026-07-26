/**
 * The access-stage machine — the single source of truth for "where is this
 * visitor allowed to be right now".
 *
 * Everything about routing in this application derives from one `Stage` value
 * computed here. Guards never make their own decisions; they ask this module.
 * That is what keeps the redirect logic in one place and provably loop-free.
 *
 * This file is deliberately free of React, Clerk, and the router so the whole
 * policy can be unit-tested as pure functions.
 */
import { OnboardingStep } from '@rooferslabs/shared';

/**
 * The progression a tenant moves through, in order. A visitor is in exactly one
 * stage at any moment, derived from the session — never stored, never guessed.
 */
export type Stage =
  /** No Clerk session. Only the marketing site and the auth pages are reachable. */
  | 'anonymous'
  /** Signed in, but the company record or its guided setup is unfinished. */
  | 'onboarding'
  /** Setup finished, no active subscription. The payment wall. */
  | 'payment'
  /** Signed in, onboarded, and paying. The application proper. */
  | 'app';

export const ROUTES = {
  marketing: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  onboarding: '/onboarding',
  payment: '/payment',
  billing: '/billing',
  dashboard: '/dashboard',
  settings: '/settings',
} as const;

/**
 * Every route except the public marketing site. Typing the access table against
 * this union means a new guarded route cannot be added without declaring who
 * may see it — the compiler asks the question.
 */
export type GuardedRoute = (typeof ROUTES)[Exclude<keyof typeof ROUTES, 'marketing'>];

/** The four wizard steps, in order. `COMPLETE` is a terminal marker, not a step. */
export const ONBOARDING_STEPS = [
  OnboardingStep.COMPANY,
  OnboardingStep.BUSINESS,
  OnboardingStep.AI,
  OnboardingStep.KNOWLEDGE,
] as const;

export type WizardStep = (typeof ONBOARDING_STEPS)[number];

/** URL slug for each wizard step, so progress is linkable and refresh-safe. */
export const STEP_SLUGS: Record<WizardStep, string> = {
  [OnboardingStep.COMPANY]: 'company',
  [OnboardingStep.BUSINESS]: 'business',
  [OnboardingStep.AI]: 'ai',
  [OnboardingStep.KNOWLEDGE]: 'review',
};

export const SLUG_TO_STEP: Record<string, WizardStep> = Object.fromEntries(
  ONBOARDING_STEPS.map((step) => [STEP_SLUGS[step], step]),
);

export const stepPath = (step: WizardStep): string => `${ROUTES.onboarding}/${STEP_SLUGS[step]}`;

export const stepIndex = (step: WizardStep): number => ONBOARDING_STEPS.indexOf(step);

/** The step after `step`, or `null` when `step` is the last one. */
export function nextStep(step: WizardStep): WizardStep | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
}

/**
 * The session facts the stage machine runs on. Kept to the minimum so the
 * policy cannot accidentally depend on anything route- or component-specific.
 */
export interface AccessFacts {
  isSignedIn: boolean;
  /** Null until the tenant creates its company in wizard step 1. */
  onboardingStep: OnboardingStep | null;
  /** Mirrors Stripe via the backend. Grandfathered tenants also read true. */
  isSubscribed: boolean;
}

/**
 * Reduce the session to a stage. This is the *only* place the ordering
 * auth → onboarding → payment → app is encoded.
 */
export function resolveStage({ isSignedIn, onboardingStep, isSubscribed }: AccessFacts): Stage {
  if (!isSignedIn) return 'anonymous';
  // No company yet, or the wizard never reached the end: setup is unfinished.
  if (onboardingStep === null || onboardingStep !== OnboardingStep.COMPLETE) {
    return 'onboarding';
  }
  if (!isSubscribed) return 'payment';
  return 'app';
}

/**
 * Which wizard step a tenant resumes at. A tenant with no company starts at the
 * beginning; `COMPLETE` should never reach here (the stage would be past
 * onboarding) but degrades to the last step rather than throwing.
 */
export function resumeStep(onboardingStep: OnboardingStep | null): WizardStep {
  if (onboardingStep === null) return OnboardingStep.COMPANY;
  if (onboardingStep === OnboardingStep.COMPLETE) return OnboardingStep.KNOWLEDGE;
  return onboardingStep;
}

/**
 * The canonical landing route for a stage — where a visitor is sent when they
 * ask for something their stage does not allow.
 *
 * INVARIANT: `home(s)` must resolve to a route whose access set contains `s`.
 * Violating it would make a redirect land somewhere that redirects again.
 * `assertNoRedirectCycles()` below proves this holds, and a unit test runs it.
 */
export function home(stage: Stage): GuardedRoute {
  switch (stage) {
    case 'anonymous':
      return ROUTES.signIn;
    case 'onboarding':
      return ROUTES.onboarding;
    case 'payment':
      return ROUTES.payment;
    case 'app':
      return ROUTES.dashboard;
  }
}

/**
 * Which stages may view each guarded route.
 *
 * `/billing` is intentionally reachable from both `payment` and `app`: Stripe
 * returns there after checkout, when the webhook that flips the tenant to
 * active has usually not landed yet. Excluding `payment` would bounce every
 * successful payer off their own receipt.
 */
export const ROUTE_ACCESS: Record<GuardedRoute, readonly Stage[]> = {
  [ROUTES.signIn]: ['anonymous'],
  [ROUTES.signUp]: ['anonymous'],
  [ROUTES.onboarding]: ['onboarding'],
  [ROUTES.payment]: ['payment'],
  [ROUTES.billing]: ['payment', 'app'],
  [ROUTES.dashboard]: ['app'],
  [ROUTES.settings]: ['app'],
};

/**
 * The one decision function. Returns the path to redirect to, or `null` to
 * render the route. Guards call this and do nothing else.
 */
export function redirectFor(stage: Stage, allowed: readonly Stage[]): GuardedRoute | null {
  if (allowed.includes(stage)) return null;
  const destination = home(stage);
  // Defensive: never emit a redirect to a route this stage also cannot view.
  // Reaching this would mean ROUTE_ACCESS and home() disagree — a bug that
  // assertNoRedirectCycles() catches in CI. Rendering the wrong page once is
  // strictly better than ping-ponging the browser, so fail open.
  if (!ROUTE_ACCESS[destination].includes(stage)) return null;
  return destination;
}

const ALL_STAGES: readonly Stage[] = ['anonymous', 'onboarding', 'payment', 'app'];

/**
 * Proves the routing table cannot loop: for every stage, following `home()`
 * from any disallowed route must land somewhere that stage is allowed to be,
 * so every redirect terminates in exactly one hop. Exercised by the unit tests.
 */
export function assertNoRedirectCycles(): void {
  for (const stage of ALL_STAGES) {
    const destination = home(stage);
    const access = ROUTE_ACCESS[destination];
    if (!access.includes(stage)) {
      throw new Error(
        `Redirect cycle: stage '${stage}' is sent to '${destination}', which excludes it.`,
      );
    }
  }
}
