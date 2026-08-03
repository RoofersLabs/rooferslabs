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
  ...overrides,
});

const access = routeAccess();

describe('resolveStage', () => {
  it('treats a visitor with no session as anonymous, whatever else is known', () => {
    expect(resolveStage(facts({ isSignedIn: false }))).toBe('anonymous');
    expect(resolveStage(facts({ isSignedIn: false, onboardingStep: null }))).toBe('anonymous');
  });

  it('sends a signed-in user with no company into onboarding', () => {
    expect(resolveStage(facts({ onboardingStep: null }))).toBe('onboarding');
  });

  it('keeps a user in onboarding until the wizard is finished', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(resolveStage(facts({ onboardingStep: step }))).toBe('onboarding');
    }
  });

  it('admits a finished tenant to the application', () => {
    expect(resolveStage(facts())).toBe('app');
  });

  it('produces only the three stages the product has', () => {
    expect(reachableStages()).toEqual(['anonymous', 'onboarding', 'app']);
  });
});

describe('redirectFor', () => {
  const cases: { stage: Stage; route: GuardedRoute; expected: string | null }[] = [
    // Each stage may sit on its own landing route.
    { stage: 'anonymous', route: ROUTES.signIn, expected: null },
    { stage: 'onboarding', route: ROUTES.onboarding, expected: null },
    { stage: 'app', route: ROUTES.dashboard, expected: null },

    // Manual URL entry into a stage the visitor has not reached.
    { stage: 'anonymous', route: ROUTES.dashboard, expected: ROUTES.signIn },
    { stage: 'onboarding', route: ROUTES.dashboard, expected: ROUTES.onboarding },
    { stage: 'onboarding', route: ROUTES.settings, expected: ROUTES.onboarding },

    // Walking backwards into a stage already left behind.
    { stage: 'app', route: ROUTES.onboarding, expected: ROUTES.dashboard },
    { stage: 'app', route: ROUTES.signIn, expected: ROUTES.dashboard },
    { stage: 'onboarding', route: ROUTES.signIn, expected: ROUTES.onboarding },
  ];

  it.each(cases)('$stage at $route → $expected', ({ stage, route, expected }) => {
    expect(redirectFor(stage, access[route], access)).toBe(expected);
  });
});

describe('the route table', () => {
  /** No route may name a payment surface — billing was removed entirely. */
  it('exposes no billing, payment or checkout route', () => {
    const paths = Object.values(ROUTES);
    for (const path of paths) {
      expect(path).not.toMatch(/billing|payment|checkout/i);
    }
  });

  it('declares an audience for every guarded route', () => {
    const guarded = Object.entries(ROUTES).filter(([name]) => name !== 'marketing');
    for (const [, path] of guarded) {
      expect(access[path as GuardedRoute]).toBeDefined();
      expect(access[path as GuardedRoute].length).toBeGreaterThan(0);
    }
  });
});

describe('the application routes', () => {
  /** Every page behind the sidebar shell requires a finished tenant. */
  const appRoutes: GuardedRoute[] = [
    ROUTES.dashboard,
    ROUTES.calls,
    ROUTES.conversations,
    ROUTES.customers,
    ROUTES.appointments,
    ROUTES.knowledge,
    ROUTES.notifications,
    ROUTES.settings,
  ];

  it.each(appRoutes)('%s admits only the app stage', (route) => {
    expect(access[route]).toEqual(['app']);
  });

  it('sends a finished tenant to the canonical dashboard, never elsewhere', () => {
    // The single canonical landing route. If this drifts from the route table in
    // App.tsx, a tenant finishing onboarding lands on a path that does not exist.
    expect(home('app')).toBe(ROUTES.dashboard);
    expect(ROUTES.dashboard).toBe('/dashboard');
  });

  it('routes a finished tenant out of onboarding into the dashboard', () => {
    // The post-onboarding hop, asserted directly: completing the wizard flips
    // the stage to 'app', and /onboarding then redirects to /dashboard. With
    // billing gone this is the only hop between setup and the product.
    expect(redirectFor('app', access[ROUTES.onboarding], access)).toBe(ROUTES.dashboard);
  });
});

describe('redirect termination', () => {
  it('has no cycles', () => {
    expect(() => assertNoRedirectCycles()).not.toThrow();
  });

  it('settles in one hop from any reachable stage on any route', () => {
    const routes = Object.keys(access) as GuardedRoute[];

    for (const stage of reachableStages()) {
      for (const route of routes) {
        const first = redirectFor(stage, access[route], access);
        if (first === null) continue;
        // Following the redirect must render, never redirect again.
        expect(redirectFor(stage, access[first], access)).toBeNull();
      }
    }
  });

  it('sends every reachable stage somewhere it may be', () => {
    for (const stage of reachableStages()) {
      expect(access[home(stage)]).toContain(stage);
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
