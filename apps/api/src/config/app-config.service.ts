import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './configuration';

/**
 * Strongly-typed accessor over Nest's ConfigService. Modules inject this rather
 * than reading `process.env` directly, keeping configuration centralized and
 * type-safe (see docs/03_Backend_Architecture.md §24).
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<{ config: AppConfig }, true>) {}

  private get root(): AppConfig {
    return this.config.get('config', { infer: true });
  }

  get env(): AppConfig['env'] {
    return this.root.env;
  }

  get isProduction(): boolean {
    return this.root.isProduction;
  }

  get api(): AppConfig['api'] {
    return this.root.api;
  }

  get database(): AppConfig['database'] {
    return this.root.database;
  }

  get redis(): AppConfig['redis'] {
    return this.root.redis;
  }

  get clerk(): AppConfig['clerk'] {
    return this.root.clerk;
  }

  get openai(): AppConfig['openai'] {
    return this.root.openai;
  }

  get twilio(): AppConfig['twilio'] {
    return this.root.twilio;
  }

  get aws(): AppConfig['aws'] {
    return this.root.aws;
  }

  get push(): AppConfig['push'] {
    return this.root.push;
  }

  get logLevel(): string {
    return this.root.logLevel;
  }
}
