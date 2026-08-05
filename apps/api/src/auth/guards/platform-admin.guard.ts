import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { PlatformAdminService } from '../platform-admin.service';

/**
 * The only gate on the internal admin portal.
 *
 * The question it asks lives in {@link PlatformAdminService}, which is also what
 * builds the answer handed to the browser — so the portal's front door and its
 * API cannot come to different conclusions about the same person.
 *
 * Applied at the controller level rather than per route, so a new admin
 * endpoint is protected by being added to the controller rather than by a
 * developer remembering a decorator.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly admins: PlatformAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.admins.assertAdmin(request.authUser);
    return true;
  }
}
