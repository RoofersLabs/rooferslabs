import { Reflector } from '@nestjs/core';
import { ALLOW_INACTIVE_SUBSCRIPTION_KEY, ALLOW_NO_COMPANY_KEY } from '../common/constants';
import { CompaniesController } from './companies.controller';

/**
 * The payment wall's exemption list, asserted directly.
 *
 * Onboarding runs before payment, so the wizard's endpoints must be reachable
 * without an active subscription — but only those. This locks the boundary:
 * adding @AllowInactiveSubscription to anything else fails here, which is the
 * point, because every exemption is a hole in the wall.
 */
const reflector = new Reflector();

const isExempt = (method: keyof CompaniesController): boolean =>
  reflector.get<boolean>(ALLOW_INACTIVE_SUBSCRIPTION_KEY, CompaniesController.prototype[method]) ===
  true;

describe('CompaniesController payment-wall exemptions', () => {
  const onboardingEndpoints: (keyof CompaniesController)[] = [
    'getMine', // GET  /companies/me                     — hydrates every step
    'update', // PATCH /companies/me                     — step 2
    'setHours', // PUT  /companies/me/business-hours      — step 2
    'getAiConfig', // GET  /companies/me/ai-configuration — step 3
    'updateAiConfig', // PATCH …/ai-configuration         — step 3
    'setStep', // PATCH /companies/me/onboarding          — progress persistence
    'complete', // POST /companies/me/onboarding/complete — step 4
  ];

  it.each(onboardingEndpoints)('allows %s before payment', (method) => {
    expect(isExempt(method)).toBe(true);
  });

  it('keeps branding behind the wall — it is not part of onboarding', () => {
    expect(isExempt('updateBranding')).toBe(false);
  });

  it('creates the company without a tenant, and without exempting billing', () => {
    // Company creation predates the tenant entirely, so it opts out via
    // @AllowNoCompany. SubscriptionGuard short-circuits on that same key, so it
    // must not also carry the billing exemption.
    expect(reflector.get<boolean>(ALLOW_NO_COMPANY_KEY, CompaniesController.prototype.create)).toBe(
      true,
    );
    expect(isExempt('create')).toBe(false);
  });
});
