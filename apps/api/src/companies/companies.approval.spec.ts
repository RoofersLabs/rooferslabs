import { Reflector } from '@nestjs/core';
import { CompanyStatus } from '@rooferslabs/shared';
import { ALLOW_UNAPPROVED_ACCOUNT_KEY } from '../common/constants';
import { CompaniesController } from './companies.controller';

/**
 * The approval wall's blast radius, asserted rather than assumed.
 *
 * `AccountStatusGuard` is global: it refuses every tenant-scoped endpoint until
 * the founder approves the account. That is the point, and it is also the thing
 * most likely to break onboarding — a tenant cannot be approved until it has
 * finished setting up, and it cannot finish setting up if the wizard's own
 * endpoints are behind the wall.
 *
 * These cases pin both halves: setup stays reachable, and the exemption stays
 * narrow enough that it never becomes a way around the wall.
 */
describe('CompaniesController and the approval wall', () => {
  const reflector = new Reflector();

  const exemption = (handler: keyof CompaniesController) =>
    reflector.getAllAndOverride<readonly CompanyStatus[]>(ALLOW_UNAPPROVED_ACCOUNT_KEY, [
      CompaniesController.prototype[handler],
      CompaniesController,
    ]);

  /** Every endpoint the guided wizard calls between step 1 and "finish". */
  const WIZARD: (keyof CompaniesController)[] = [
    'getMine',
    'update',
    'setHours',
    'getAiConfig',
    'updateAiConfig',
    'setStep',
    'complete',
  ];

  it.each(WIZARD)('%s stays reachable while a tenant is still in setup', (handler) => {
    expect(exemption(handler)).toContain(CompanyStatus.ONBOARDING);
  });

  it.each(WIZARD)('%s admits ONBOARDING and nothing else', (handler) => {
    // The narrowness is the safeguard. If one of these ever also admitted
    // PENDING_APPROVAL or PAUSED, a tenant behind the wall would keep a live
    // write surface into its own company — which is most of what the wall is
    // supposed to take away.
    expect(exemption(handler)).toEqual([CompanyStatus.ONBOARDING]);
  });

  it('does not exempt branding, which is not part of setup', () => {
    // Named explicitly because it is the one endpoint on this controller that
    // looks like the others and must not behave like them.
    expect(exemption('updateBranding')).toBeUndefined();
  });

  it('exempts no endpoint at the class level', () => {
    // A class-level exemption would silently cover every endpoint added here
    // later. Listing them one at a time is what makes each one a decision.
    expect(
      Reflect.getMetadata(ALLOW_UNAPPROVED_ACCOUNT_KEY, CompaniesController) as unknown,
    ).toBeUndefined();
  });
});
