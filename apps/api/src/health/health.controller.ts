import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
      status === 'ready' ? 'All dependencies healthy.' : 'Cache is degraded; service remains available.',
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
