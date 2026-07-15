import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ForbiddenError } from '../exceptions/domain.exception';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Injects the authenticated user's company id — the tenant scope for every
 * query. Throws if the user has no company yet (guarded separately by the
 * TenantGuard, this is a defensive fallback).
 */
export const CurrentCompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.authUser?.companyId;
    if (!companyId) {
      throw new ForbiddenError('No active company is associated with this account.');
    }
    return companyId;
  },
);
