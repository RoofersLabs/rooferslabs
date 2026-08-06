import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CompanyStatus } from '@rooferslabs/shared';
import {
  ALLOW_NO_COMPANY_KEY,
  ALLOW_UNAPPROVED_ACCOUNT_KEY,
  IS_PUBLIC_KEY,
} from '../../common/constants';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AccountStatusService } from '../account-status.service';

/**
 * The founder-approval wall, and the reason no controller has to think about
 * approval at all.
 *
 * Registered globally, so a tenant-scoped endpoint is gated by existing rather
 * than by a developer remembering a decorator. That is the whole design: the
 * question "has this account been approved?" is asked once, before any handler
 * runs, and an endpoint added next month inherits the answer for free. Spreading
 * the same check through controllers is how one of them ends up without it.
 *
 * Runs after {@link TenantGuard} — which has already established that the caller
 * belongs to a company — and *before* `SubscriptionGuard`, because approval
 * comes before payment: a tenant nobody has admitted should never be shown a
 * checkout, and a paused one should never be asked to keep paying.
 *
 * Three exits, and each is deliberate:
 *
 * - `@Public` and `@AllowNoCompany` skip it. Both name routes with no tenant to
 *   check — Twilio's webhooks, `/auth/me`, the admin portal — and `/auth/me` in
 *   particular *must* stay reachable, since it is how a pending tenant's browser
 *   learns it is pending and what its waiting screen renders from.
 * - `@AllowUnapprovedAccount(...)` widens it to the statuses that route names —
 *   `ONBOARDING` by default, for the setup wizard, which runs before approval is
 *   possible. It is a widening, not a skip: a paused tenant is still refused by
 *   a wizard endpoint, because the wizard never asked to serve one.
 * - Everything else is refused with 403 and a code the client branches on.
 *
 * The refusal is the enforcement. The waiting screen in the browser is a
 * courtesy; a caller who deletes it, edits the session payload, or writes their
 * own client reaches exactly the same wall, because the status is read from the
 * database on the request rather than taken from anything the caller sent.
 */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accounts: AccountStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const [isPublic, allowNoCompany] = [IS_PUBLIC_KEY, ALLOW_NO_COMPANY_KEY].map((key) =>
      this.reflector.getAllAndOverride<boolean>(key, targets),
    );
    if (isPublic || allowNoCompany) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.authUser?.companyId;
    // No company yet: TenantGuard has already rejected this request.
    if (!companyId) return true;

    const alsoAdmitted =
      this.reflector.getAllAndOverride<readonly CompanyStatus[]>(
        ALLOW_UNAPPROVED_ACCOUNT_KEY,
        targets,
      ) ?? [];

    await this.accounts.assertActive(companyId, alsoAdmitted);
    return true;
  }
}
