import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/constants';
import { UnauthorizedError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from '../auth.service';

/**
 * Global authentication guard. Verifies the bearer token on every request
 * (unless the route is @Public) and attaches the resolved platform user to the
 * request. Runs before authorization and any business logic.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedError('A valid authentication token is required.');
    }

    request.authUser = await this.authService.authenticate(token);
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
