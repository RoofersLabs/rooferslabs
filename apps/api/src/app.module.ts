import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';

import { AuthModule } from './auth/auth.module';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { TenantGuard } from './auth/guards/tenant.guard';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { CustomersModule } from './customers/customers.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CallsModule } from './calls/calls.module';
import { TelephonyModule } from './telephony/telephony.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';

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
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
          customProps: (req) => ({ requestId: (req as { requestId?: string }).requestId }),
          autoLogging: { ignore: (req) => req.url === '/v1/health' },
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    AuthModule,
    UsersModule,
    CompaniesModule,
    AiModule,
    KnowledgeModule,
    ReceptionistModule,
    CustomersModule,
    AppointmentsModule,
    NotificationsModule,
    CallsModule,
    TelephonyModule,
    DashboardModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    // Order matters: authentication → throttling → tenant isolation → roles.
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
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
