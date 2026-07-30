import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_LAUNCH_EXEMPT_KEY, IS_PUBLIC_KEY } from '../../common/constants';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { AppConfigService } from '../../config/app-config.service';
import { isInternalUser } from '../../config/launch.flag';

/**
 * The private-beta gate, and the whole of its server-side enforcement.
 *
 * Registered globally immediately after ClerkAuthGuard, so it sees a resolved
 * `authUser` and covers EVERY route in the API without any controller opting
 * in. That placement is the point: a gate a route has to remember to apply is a
 * gate that a new route forgets. There is no route-level allow flag, no second
 * copy of this check, and no way for a feature module to bypass it.
 *
 * What it does NOT gate: routes marked `@Public()`. Those are machine callers
 * that carry their own authentication and must keep working during the beta —
 * the ALB health check (gating it would fail the target group and take
 * production down), Twilio's signed telephony webhooks, the payment
 * provider's signed billing webhooks, and the unauthenticated launch endpoints
 * themselves. None of them serves application data to a browser, and each
 * verifies its own caller, so passing them through widens nothing.
 *
 * Everything else — every authenticated route, which is every route that
 * returns customer data — requires a signed-in user on the internal allowlist.
 * A visitor who signs up through Clerk during the beta therefore gets a real
 * session and still cannot read a single record.
 */
@Injectable()
export class LaunchGateGuard implements CanActivate {
  private readonly logger = new Logger(LaunchGateGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { mode, internalUsers } = this.config.launch;

    // Normal operation. Resolved at boot from configuration, so switching the
    // beta off is an environment change and a restart — never a deployment of
    // different code.
    if (mode === 'public') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Authenticated but exempt: the single endpoint the SPA calls to ask
    // whether the signed-in caller is allowed in. It has to answer "no" rather
    // than 403, or the browser cannot tell "you are not on the list" apart from
    // "the API is down" and would show the wrong thing in both cases.
    const isLaunchExempt = this.reflector.getAllAndOverride<boolean>(IS_LAUNCH_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isLaunchExempt) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // ClerkAuthGuard runs first and has already rejected an unauthenticated
    // caller on a non-public route, so reaching here without a user would mean
    // the guard order changed. Refuse rather than assume.
    const user = request.authUser;

    if (isInternalUser(user?.email, internalUsers)) {
      return true;
    }

    // Tracked: rejected access attempts. Warn rather than log, because during a
    // private beta this is either a real person who should not be here or an
    // internal account that was never added to the allowlist — both worth
    // seeing without going looking.
    this.logger.warn({
      event: 'launch_gate.access_denied',
      email: user?.email ?? null,
      userId: user?.id ?? null,
      method: request.method,
      path: request.originalUrl ?? request.url,
      requestId: request.requestId,
    });

    // Deliberately says nothing about an allowlist existing. A visitor learning
    // that access is granted per-address learns which lever to attack.
    throw new ForbiddenError('RoofersLabs is not yet open to the public.');
  }
}
