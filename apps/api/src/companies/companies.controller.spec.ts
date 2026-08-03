import { Reflector } from '@nestjs/core';
import { ALLOW_NO_COMPANY_KEY } from '../common/constants';
import { CompaniesController } from './companies.controller';

/**
 * Company creation is the one endpoint that predates the tenant record, so it
 * is the one endpoint that must opt out of TenantGuard. Asserted directly
 * because losing the decorator would lock every new signup out of onboarding.
 */
const reflector = new Reflector();

describe('CompaniesController tenant exemptions', () => {
  it('creates the company without requiring an existing tenant', () => {
    expect(reflector.get<boolean>(ALLOW_NO_COMPANY_KEY, CompaniesController.prototype.create)).toBe(
      true,
    );
  });

  it('does not exempt any other endpoint from tenant resolution', () => {
    const others: (keyof CompaniesController)[] = [
      'getMine',
      'update',
      'setHours',
      'getAiConfig',
      'updateAiConfig',
      'setStep',
      'complete',
      'updateBranding',
    ];
    for (const method of others) {
      expect(
        reflector.get<boolean>(ALLOW_NO_COMPANY_KEY, CompaniesController.prototype[method]),
      ).not.toBe(true);
    }
  });
});
