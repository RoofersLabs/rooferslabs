import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_NO_COMPANY_KEY, IS_PUBLIC_KEY } from '../../common/constants';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

/**
 * Enforces that an authenticated user belongs to a company (tenant) before
 * reaching tenant-scoped endpoints. Endpoints reachable before a company exists
 * (auth/me, company creation) opt out with @AllowNoCompany. This is a
 * defense-in-depth companion to per-query `companyId` scoping.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const [isPublic, allowNoCompany] = [IS_PUBLIC_KEY, ALLOW_NO_COMPANY_KEY].map((key) =>
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]),
    );
    if (isPublic || allowNoCompany) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser?.companyId) {
      throw new ForbiddenError('You must create or join a company before accessing this resource.');
    }
    return true;
  }
}
