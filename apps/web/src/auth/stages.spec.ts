import { OnboardingStep } from '@rooferslabs/shared';
import {
  ONBOARDING_STEPS,
  ROUTES,
  assertNoRedirectCycles,
  home,
  nextStep,
  reachableStages,
  redirectFor,
  resolveStage,
  resumeStep,
  routeAccess,
  stepPath,
  type GuardedRoute,
  type Stage,
} from './stages';

const facts = (overrides: Partial<Parameters<typeof resolveStage>[0]> = {}) => ({
  isSignedIn: true,
  onboardingStep: OnboardingStep.COMPLETE,
  isSubscribed: true,
  paymentsEnabled: true,
  ...overrides,
});

/** Access table with billing on — the full production flow. */
const withPayments = routeAccess(true);
/** Access table with billing off — PAYMENTS_ENABLED=false. */
const withoutPayments = routeAccess(false);

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

describe('resolveStage with payments disabled', () => {
  it('sends an unsubscribed tenant straight to the application', () => {
    // The whole point of the flag: onboarding → dashboard, no payment step.
    expect(resolveStage(facts({ isSubscribed: false, paymentsEnabled: false }))).toBe('app');
  });

  it('never produces the payment stage', () => {
    for (const isSubscribed of [true, false]) {
      expect(resolveStage(facts({ isSubscribed, paymentsEnabled: false }))).not.toBe('payment');
    }
    expect(reachableStages(false)).not.toContain('payment');
  });

  it('still gates onboarding and authentication', () => {
    // Disabling billing must not weaken anything earlier in the chain.
    expect(resolveStage(facts({ isSignedIn: false, paymentsEnabled: false }))).toBe('anonymous');
    expect(resolveStage(facts({ onboardingStep: null, paymentsEnabled: false }))).toBe(
      'onboarding',
    );
    expect(resolveStage(facts({ onboardingStep: OnboardingStep.AI, paymentsEnabled: false }))).toBe(
      'onboarding',
    );
  });
});

describe('redirectFor', () => {
  const cases: { stage: Stage; route: GuardedRoute; expected: string | null }[] = [
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
    expect(redirectFor(stage, withPayments[route], withPayments)).toBe(expected);
  });

  it('never shows the payment page to a subscribed tenant', () => {
    expect(redirectFor('app', withPayments[ROUTES.payment], withPayments)).toBe(ROUTES.dashboard);
  });

  it('keeps billing reachable both before and after activation', () => {
    // Stripe returns to /billing before the activation webhook lands, so the
    // page must render in both stages or every payer bounces off their receipt.
    expect(redirectFor('payment', withPayments[ROUTES.billing], withPayments)).toBeNull();
    expect(redirectFor('app', withPayments[ROUTES.billing], withPayments)).toBeNull();
  });
});

describe('billing routes with payments disabled', () => {
  it('turns everyone away from /payment and /billing', () => {
    for (const route of [ROUTES.payment, ROUTES.billing] as GuardedRoute[]) {
      expect(withoutPayments[route]).toEqual([]);
      for (const stage of reachableStages(false)) {
        expect(redirectFor(stage, withoutPayments[route], withoutPayments)).toBe(home(stage));
      }
    }
  });

  it('leaves the rest of the table untouched', () => {
    for (const route of [
      ROUTES.signIn,
      ROUTES.signUp,
      ROUTES.onboarding,
      ROUTES.dashboard,
      ROUTES.settings,
    ] as GuardedRoute[]) {
      expect(withoutPayments[route]).toEqual(withPayments[route]);
    }
  });
});

describe('redirect termination', () => {
  it.each([true, false])('has no cycles with paymentsEnabled=%s', (paymentsEnabled) => {
    expect(() => assertNoRedirectCycles(paymentsEnabled)).not.toThrow();
  });

  it.each([true, false])(
    'settles in one hop from any reachable stage on any route (paymentsEnabled=%s)',
    (paymentsEnabled) => {
      const access = routeAccess(paymentsEnabled);
      const routes = Object.keys(access) as GuardedRoute[];

      for (const stage of reachableStages(paymentsEnabled)) {
        for (const route of routes) {
          const first = redirectFor(stage, access[route], access);
          if (first === null) continue;
          // Following the redirect must render, never redirect again.
          expect(redirectFor(stage, access[first], access)).toBeNull();
        }
      }
    },
  );

  it.each([true, false])(
    'sends every reachable stage somewhere it may be (paymentsEnabled=%s)',
    (paymentsEnabled) => {
      const access = routeAccess(paymentsEnabled);
      for (const stage of reachableStages(paymentsEnabled)) {
        expect(access[home(stage)]).toContain(stage);
      }
    },
  );
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
