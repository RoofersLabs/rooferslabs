import { OnboardingStep } from '@rooferslabs/shared';
import {
  ONBOARDING_STEPS,
  ROUTES,
  ROUTE_ACCESS,
  assertNoRedirectCycles,
  home,
  nextStep,
  redirectFor,
  resolveStage,
  resumeStep,
  stepPath,
  type Stage,
} from './stages';

const facts = (overrides: Partial<Parameters<typeof resolveStage>[0]> = {}) => ({
  isSignedIn: true,
  onboardingStep: OnboardingStep.COMPLETE,
  isSubscribed: true,
  ...overrides,
});

describe('resolveStage', () => {
  it('treats a visitor with no session as anonymous, whatever else is known', () => {
    expect(resolveStage(facts({ isSignedIn: false }))).toBe('anonymous');
    expect(
      resolveStage(facts({ isSignedIn: false, onboardingStep: null, isSubscribed: false })),
    ).toBe('anonymous');
  });

  it('sends a signed-in user with no company into onboarding', () => {
    expect(resolveStage(facts({ onboardingStep: null, isSubscribed: false }))).toBe('onboarding');
  });

  it('keeps a user in onboarding until the wizard is finished', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(resolveStage(facts({ onboardingStep: step }))).toBe('onboarding');
    }
  });

  it('holds an unfinished tenant in onboarding even if it somehow already paid', () => {
    expect(resolveStage(facts({ onboardingStep: OnboardingStep.AI, isSubscribed: true }))).toBe(
      'onboarding',
    );
  });

  it('sends a finished but unpaid tenant to payment', () => {
    expect(resolveStage(facts({ isSubscribed: false }))).toBe('payment');
  });

  it('admits a finished, paying tenant to the application', () => {
    expect(resolveStage(facts())).toBe('app');
  });
});

describe('redirectFor', () => {
  const cases: { stage: Stage; route: keyof typeof ROUTE_ACCESS; expected: string | null }[] = [
    // Each stage may sit on its own landing route.
    { stage: 'anonymous', route: ROUTES.signIn, expected: null },
    { stage: 'onboarding', route: ROUTES.onboarding, expected: null },
    { stage: 'payment', route: ROUTES.payment, expected: null },
    { stage: 'app', route: ROUTES.dashboard, expected: null },

    // Manual URL entry into a stage the visitor has not reached.
    { stage: 'anonymous', route: ROUTES.dashboard, expected: ROUTES.signIn },
    { stage: 'onboarding', route: ROUTES.dashboard, expected: ROUTES.onboarding },
    { stage: 'onboarding', route: ROUTES.payment, expected: ROUTES.onboarding },
    { stage: 'payment', route: ROUTES.dashboard, expected: ROUTES.payment },
    { stage: 'payment', route: ROUTES.settings, expected: ROUTES.payment },

    // Walking backwards into a stage already left behind.
    { stage: 'app', route: ROUTES.onboarding, expected: ROUTES.dashboard },
    { stage: 'app', route: ROUTES.signIn, expected: ROUTES.dashboard },
    { stage: 'onboarding', route: ROUTES.signIn, expected: ROUTES.onboarding },
  ];

  it.each(cases)('$stage at $route → $expected', ({ stage, route, expected }) => {
    expect(redirectFor(stage, ROUTE_ACCESS[route])).toBe(expected);
  });

  it('never shows the payment page to a subscribed tenant', () => {
    expect(redirectFor('app', ROUTE_ACCESS[ROUTES.payment])).toBe(ROUTES.dashboard);
  });

  it('keeps billing reachable both before and after activation', () => {
    // Stripe returns to /billing before the activation webhook lands, so the
    // page must render in both stages or every payer bounces off their receipt.
    expect(redirectFor('payment', ROUTE_ACCESS[ROUTES.billing])).toBeNull();
    expect(redirectFor('app', ROUTE_ACCESS[ROUTES.billing])).toBeNull();
  });
});

describe('redirect termination', () => {
  it('has no cycles in the route table', () => {
    expect(() => assertNoRedirectCycles()).not.toThrow();
  });

  it('settles in exactly one hop from any stage on any guarded route', () => {
    const stages: Stage[] = ['anonymous', 'onboarding', 'payment', 'app'];
    const routes = Object.keys(ROUTE_ACCESS) as (keyof typeof ROUTE_ACCESS)[];

    for (const stage of stages) {
      for (const route of routes) {
        const first = redirectFor(stage, ROUTE_ACCESS[route]);
        if (first === null) continue;
        // Following the redirect must render, never redirect again.
        expect(redirectFor(stage, ROUTE_ACCESS[first])).toBeNull();
      }
    }
  });

  it('sends every stage to a route that stage can actually view', () => {
    for (const stage of ['anonymous', 'onboarding', 'payment', 'app'] as Stage[]) {
      expect(ROUTE_ACCESS[home(stage)]).toContain(stage);
    }
  });
});

describe('wizard progression', () => {
  it('orders the four steps and terminates', () => {
    expect(ONBOARDING_STEPS).toHaveLength(4);
    expect(nextStep(OnboardingStep.COMPANY)).toBe(OnboardingStep.BUSINESS);
    expect(nextStep(OnboardingStep.BUSINESS)).toBe(OnboardingStep.AI);
    expect(nextStep(OnboardingStep.AI)).toBe(OnboardingStep.KNOWLEDGE);
    expect(nextStep(OnboardingStep.KNOWLEDGE)).toBeNull();
  });

  it('resumes a tenant with no company at the first step', () => {
    expect(resumeStep(null)).toBe(OnboardingStep.COMPANY);
  });

  it('resumes at the persisted step', () => {
    expect(resumeStep(OnboardingStep.AI)).toBe(OnboardingStep.AI);
  });

  it('degrades COMPLETE to the last step rather than throwing', () => {
    // The stage machine should never route a COMPLETE tenant here, but a stale
    // cache must not crash the wizard.
    expect(resumeStep(OnboardingStep.COMPLETE)).toBe(OnboardingStep.KNOWLEDGE);
  });

  it('gives every step a distinct path under /onboarding', () => {
    const paths = ONBOARDING_STEPS.map(stepPath);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith(`${ROUTES.onboarding}/`)).toBe(true);
  });
});
