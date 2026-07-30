import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  AllowInactiveSubscription,
  AllowNoCompany,
  LaunchGateExempt,
  Public,
} from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { respond } from '../common/response';
import { CreateEarlyAccessRequestDto } from './dto/early-access.dto';
import { LaunchService } from './launch.service';

/**
 * The only surface an anonymous visitor may reach during the private beta.
 *
 * Both routes are `@Public()`, which is also what exempts them from
 * LaunchGateGuard — a gate that blocked the launch page's own endpoints would
 * leave the beta showing an error instead of a launch page.
 *
 * Neither route reads or returns a single piece of customer data. That is the
 * property that makes them safe to expose: the gate does not need to protect
 * them because there is nothing behind them to protect.
 */
@ApiTags('launch')
@Controller('launch')
export class LaunchController {
  constructor(private readonly launchService: LaunchService) {}

  /**
   * Whether the application is gated, served to the SPA on boot.
   *
   * Runtime rather than build-time so that lifting the gate is an environment
   * change plus a restart, with no frontend rebuild — which is what makes
   * launch day the four steps it is supposed to be.
   */
  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Public launch state. Returns the mode and nothing else.' })
  getConfig() {
    return respond(this.launchService.getPublicConfig());
  }

  /**
   * May the signed-in caller enter the application?
   *
   * Authenticated (a token is required) but exempt from the gate, so it can
   * answer `false` instead of 403. The SPA needs that distinction: a 403 is
   * indistinguishable from an outage, and it would render the launch page for
   * an internal user whose network hiccuped.
   *
   * Returns a single boolean. It never says why, never echoes the allowlist,
   * and never confirms whether some other address would have been admitted.
   */
  @Get('access')
  @LaunchGateExempt()
  @AllowNoCompany()
  @AllowInactiveSubscription()
  @ApiOperation({ summary: 'Whether the authenticated caller may enter during the private beta.' })
  getAccess(@Req() request: AuthenticatedRequest) {
    return respond(this.launchService.checkAccess(request.authUser?.email));
  }

  /**
   * Early-access request from the launch page.
   *
   * Rate-limited well below the global default: this is an unauthenticated
   * write reachable by anyone on the internet, and the honest traffic is a
   * handful of submissions a day. Five per minute per IP leaves a real person
   * who mistypes their address room to correct it, while making the endpoint
   * useless for filling the table.
   */
  @Post('early-access')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register interest. Creates a lead, never an account.' })
  async requestEarlyAccess(@Body() dto: CreateEarlyAccessRequestDto, @Req() request: Request) {
    const result = await this.launchService.recordEarlyAccessRequest(dto, {
      referrer: request.get('referer') ?? undefined,
      userAgent: request.get('user-agent') ?? undefined,
    });
    return respond(result);
  }
}
