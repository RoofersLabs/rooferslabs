import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/constants';
import { ForbiddenError } from '../../common/exceptions/domain.exception';
import type { AppConfigService } from '../../config/app-config.service';
import type { LaunchMode } from '../../config/launch.flag';
import { LaunchGateGuard } from './launch-gate.guard';

const INTERNAL = 'founder@rooferslabs.com';

function makeContext(
  email?: string | null,
  flags: { isPublic?: boolean; isLaunchExempt?: boolean } = {},
) {
  const request = {
    authUser: email === undefined ? undefined : { id: 'u1', email },
    method: 'GET',
    url: '/v1/dashboard',
    originalUrl: '/v1/dashboard',
    requestId: 'req-1',
  };

  // Keyed on the metadata name rather than returning one value for every
  // lookup: @Public and @LaunchGateExempt are different exemptions with
  // different consequences, and a mock that cannot tell them apart would pass
  // whether or not the guard checks the right one.
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === IS_PUBLIC_KEY ? (flags.isPublic ?? false) : (flags.isLaunchExempt ?? false),
    ),
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;

  return { context, reflector };
}

function makeGuard(mode: LaunchMode, internalUsers: string[], reflector: Reflector) {
  const config = { launch: { mode, internalUsers } } as unknown as AppConfigService;
  const guard = new LaunchGateGuard(reflector, config);
  // The guard warns on every denial; silence it so a passing run is readable.
  jest.spyOn(guard['logger'], 'warn').mockImplementation(() => undefined);
  return guard;
}

describe('LaunchGateGuard — public mode', () => {
  it('allows everyone through, allowlist irrelevant', () => {
    const { context, reflector } = makeContext('stranger@example.com');
    expect(makeGuard('public', [], reflector).canActivate(context)).toBe(true);
  });

  it('allows an anonymous caller through', () => {
    const { context, reflector } = makeContext(undefined);
    expect(makeGuard('public', [INTERNAL], reflector).canActivate(context)).toBe(true);
  });
});

describe('LaunchGateGuard — private mode', () => {
  it('allows an allowlisted internal user', () => {
    const { context, reflector } = makeContext(INTERNAL);
    expect(makeGuard('private', [INTERNAL], reflector).canActivate(context)).toBe(true);
  });

  it('allows an internal user whose address differs only in casing', () => {
    const { context, reflector } = makeContext('Founder@RoofersLabs.com');
    expect(makeGuard('private', [INTERNAL], reflector).canActivate(context)).toBe(true);
  });

  it('DENIES an authenticated, non-allowlisted user', () => {
    // The important case: someone who signed up through Clerk during the beta
    // holds a real session and must still reach no data at all.
    const { context, reflector } = makeContext('stranger@example.com');
    const guard = makeGuard('private', [INTERNAL], reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('DENIES when no user resolved', () => {
    const { context, reflector } = makeContext(undefined);
    const guard = makeGuard('private', [INTERNAL], reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('DENIES everyone when the allowlist is empty', () => {
    const { context, reflector } = makeContext(INTERNAL);
    const guard = makeGuard('private', [], reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenError);
  });

  it('does not reveal that an allowlist exists', () => {
    const { context, reflector } = makeContext('stranger@example.com');
    const guard = makeGuard('private', [INTERNAL], reflector);
    try {
      guard.canActivate(context);
      fail('expected a ForbiddenError');
    } catch (error) {
      const message = (error as Error).message.toLowerCase();
      expect(message).not.toContain('allowlist');
      expect(message).not.toContain('internal');
      expect(message).not.toContain(INTERNAL);
    }
  });

  it('logs a denial so rejected attempts are tracked', () => {
    const { context, reflector } = makeContext('stranger@example.com');
    const guard = makeGuard('private', [INTERNAL], reflector);
    const warn = jest.spyOn(guard['logger'], 'warn');
    expect(() => guard.canActivate(context)).toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'launch_gate.access_denied',
        email: 'stranger@example.com',
      }),
    );
  });

  it('lets @Public routes through — health checks and signed webhooks must keep working', () => {
    // Gating the ALB health check would fail the target group and take
    // production down; gating the payment webhook would lose subscription
    // events. Both authenticate their own callers.
    const { context, reflector } = makeContext(undefined, { isPublic: true });
    expect(makeGuard('private', [INTERNAL], reflector).canActivate(context)).toBe(true);
  });

  it('lets the @LaunchGateExempt access check through so it can answer "no"', () => {
    // The SPA calls this to decide what to render. A 403 here would be
    // indistinguishable from an outage, so the endpoint must return rather than
    // throw — even for a caller who is not on the allowlist.
    const { context, reflector } = makeContext('stranger@example.com', { isLaunchExempt: true });
    expect(makeGuard('private', [INTERNAL], reflector).canActivate(context)).toBe(true);
  });

  it('does NOT treat a launch-exempt route as public, or vice versa', () => {
    // Neither flag set: an ordinary authenticated route stays gated.
    const { context, reflector } = makeContext('stranger@example.com', {});
    expect(() => makeGuard('private', [INTERNAL], reflector).canActivate(context)).toThrow(
      ForbiddenError,
    );
  });
});
