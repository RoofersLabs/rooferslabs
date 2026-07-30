import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

function canResolve(moduleName: string): boolean {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
}
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResilientThrottlerStorage } from './common/resilient-throttler.storage';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

import { AuthModule } from './auth/auth.module';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { LaunchGateGuard } from './auth/guards/launch-gate.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { SubscriptionGuard } from './auth/guards/subscription.guard';
import { TenantGuard } from './auth/guards/tenant.guard';
import { UsersModule } from './users/users.module';
import { BillingModule } from './billing/billing.module';
import { CompaniesModule } from './companies/companies.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { CustomersModule } from './customers/customers.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CallsModule } from './calls/calls.module';
import { TelephonyModule } from './telephony/telephony.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { LaunchModule } from './launch/launch.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          // Never log secrets or tokens.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-twilio-signature"]',
              'res.headers["set-cookie"]',
            ],
            remove: true,
          },
          // Pretty logs only when pino-pretty is installed (it is a dev
          // dependency, absent from production images) — otherwise the app
          // would crash at boot when run with NODE_ENV!=production.
          transport:
            !config.isProduction && canResolve('pino-pretty')
              ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
              : undefined,
          customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
          autoLogging: { ignore: (req) => req.url === '/v1/health' },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        // Global limits across all API tasks via Redis, falling back to
        // per-instance memory when Redis is unavailable (fail-open).
        storage: new ResilientThrottlerStorage(redis.raw),
      }),
    }),
    AuthModule,
    UsersModule,
    BillingModule,
    CompaniesModule,
    AiModule,
    KnowledgeModule,
    ReceptionistModule,
    CustomersModule,
    AppointmentsModule,
    NotificationsModule,
    CallsModule,
    TelephonyModule,
    AdminModule,
    DashboardModule,
    SearchModule,
    HealthModule,
    LaunchModule,
  ],
  providers: [
    // Order matters: authentication → launch gate → throttling → tenant
    // isolation → subscription (payment wall) → roles.
    //
    // The launch gate sits immediately after authentication because it needs a
    // resolved `authUser` to check against the allowlist, and before everything
    // else because during a private beta no further work should happen for a
    // caller who is not getting in — including tenant resolution, which reads
    // the database.
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: LaunchGateGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
