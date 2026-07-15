import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validateEnv } from './env.validation';
import { AppConfigService } from './app-config.service';

/**
 * Global configuration module. Loads and validates environment variables once
 * and exposes the typed {@link AppConfigService} everywhere.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Root .env is the single source of truth for local development.
      envFilePath: ['.env', '../../.env'],
      load: [() => ({ config: configuration() })],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
