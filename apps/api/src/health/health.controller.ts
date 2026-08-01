import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingReadinessService } from '../billing/provisioning/billing-readiness.service';
import { Public } from '../common/decorators/public.decorator';
import { respond } from '../common/response';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly billing: BillingReadinessService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return respond(
      { status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
      'Service is live.',
    );
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe (checks database and cache)' })
  async ready() {
    const [database, cache] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    // The database is a hard dependency: without it the instance must be taken
    // out of rotation (503). Redis only degrades caching, so it is reported but
    // does not fail readiness.
    if (!database) {
      throw new ServiceUnavailableException('Database is unreachable.');
    }

    const status = cache ? 'ready' : 'degraded';
    return respond(
      { status, checks: { database, cache } },
      status === 'ready'
        ? 'All dependencies healthy.'
        : 'Cache is degraded; service remains available.',
    );
  }

  /**
   * Whether this deployment can actually take money, and what is missing.
   *
   * Separate from `/ready` because they answer different questions and belong to
   * different audiences: `/ready` decides whether the ALB keeps this task in
   * rotation, and billing must never influence that — an instance that serves
   * every existing customer perfectly should not be pulled out because a plan
   * has not been provisioned yet.
   *
   * Public, and deliberately redacted: it returns check names and remedies, and
   * never an identifier. Knowing that a deployment's billing is unconfigured is
   * of no use to an attacker; knowing its live plan ids might be.
   */
  @Get('billing')
  @Public()
  @ApiOperation({ summary: 'Billing provisioning diagnostics' })
  async billingReadiness() {
    const readiness = await this.billing.check();
    return respond(
      {
        ready: readiness.ready,
        enabled: readiness.enabled,
        provider: readiness.provider,
        environment: readiness.environment,
        testPricing: readiness.testPricing,
        checks: readiness.checks.map((check) => ({
          name: check.name,
          ok: check.ok,
          ...(check.remedy ? { remedy: check.remedy } : {}),
        })),
      },
      readiness.ready
        ? readiness.testPricing
          ? 'Billing is ready, charging TEST pricing.'
          : 'Billing is ready.'
        : 'Billing is not fully provisioned.',
    );
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.raw.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
