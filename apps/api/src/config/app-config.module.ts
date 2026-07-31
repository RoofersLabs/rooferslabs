import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validateEnv } from './env.validation';
import { AppConfigService } from './app-config.service';

/**
 * Global configuration module. Loads and validates environment variables once
 * and exposes the typed {@link AppConfigService} everywhere.
 */
/**
 * Env files, most specific first — Nest keeps the first definition of a key.
 *
 * `.env.<tier>` lets one machine hold configuration for more than one
 * environment without editing a file between runs; `.env` remains the single
 * file most local work needs. Deployed environments have no env file at all:
 * ECS injects plain values from the task definition and secrets from Secrets
 * Manager, so this list simply finds nothing there.
 */
const envFilePath = (): string[] => {
  const tier = process.env.APP_ENV?.trim().toLowerCase();
  const tierFiles = tier ? [`.env.${tier}`, `../../.env.${tier}`] : [];
  return [...tierFiles, '.env', '../../.env'];
};

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: envFilePath(),
      load: [() => ({ config: configuration() })],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
