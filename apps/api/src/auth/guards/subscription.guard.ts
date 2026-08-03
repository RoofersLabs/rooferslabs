import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiErrorCode } from '@rooferslabs/shared';
import { BillingService } from '../../billing/services/billing.service';
import {
  ALLOW_INACTIVE_SUBSCRIPTION_KEY,
  ALLOW_NO_COMPANY_KEY,
  IS_PUBLIC_KEY,
} from '../../common/constants';
import { DomainException } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

/**
 * Payment wall. Runs after authentication and tenant resolution, and rejects
 * every tenant-scoped request from a company without an active (or trialing)
 * subscription.
 *
 * The response carries HTTP 402 and the stable SUBSCRIPTION_REQUIRED code, which
 * the frontend translates into a redirect to /billing. Endpoints reachable
 * before payment opt out with @Public, @AllowNoCompany, or
 * @AllowInactiveSubscription — the billing surface itself must stay reachable.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const [isPublic, allowNoCompany, allowInactive] = [
      IS_PUBLIC_KEY,
      ALLOW_NO_COMPANY_KEY,
      ALLOW_INACTIVE_SUBSCRIPTION_KEY,
    ].map((key) =>
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]),
    );
    if (isPublic || allowNoCompany || allowInactive) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.authUser?.companyId;
    // No company yet: TenantGuard has already rejected this request.
    if (!companyId) return true;

    if (await this.billing.hasActiveSubscription(companyId)) return true;

    throw new DomainException(
      ApiErrorCode.SUBSCRIPTION_REQUIRED,
      'An active subscription is required to use rooferslabs. Please complete payment to continue.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
