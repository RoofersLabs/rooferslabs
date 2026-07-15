import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UnauthorizedError } from '../exceptions/domain.exception';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../interfaces/authenticated-request.interface';

/** Injects the authenticated platform user resolved by the Clerk auth guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) {
      throw new UnauthorizedError();
    }
    return request.authUser;
  },
);
