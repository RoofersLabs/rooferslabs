import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlatformRole } from '@rooferslabs/shared';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

/**
 * The only gate on the internal admin portal.
 *
 * It checks `platformRole`, never `role`. `UserRole.OWNER` is the default
 * assigned to every account at signup — it means "owner of this roofing
 * company", so gating on it would have opened the portal to the entire customer
 * base. `platformRole` defaults to NONE, so an account gains nothing by
 * existing; it has to be granted in the database by hand.
 *
 * Applied at the controller level rather than per route, so a new admin
 * endpoint is protected by being added to the controller rather than by a
 * developer remembering a decorator.
 *
 * The error is deliberately the same 403 a customer would get from any other
 * forbidden resource: it does not confirm that an admin surface exists.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const platformRole = request.authUser?.platformRole;

    if (platformRole !== PlatformRole.OWNER) {
      throw new ForbiddenError('You do not have access to this resource.');
    }
    return true;
  }
}
