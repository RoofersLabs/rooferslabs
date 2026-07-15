import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@rooferslabs/shared';
import { ROLES_KEY } from '../../common/constants';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

/** Enforces @Roles(...) on endpoints that require specific roles. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.authUser?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenError('Your role does not permit this action.');
    }
    return true;
  }
}
