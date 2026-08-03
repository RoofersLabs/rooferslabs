/**
 * Typed application configuration.
 *
 * Values are read once from the environment (validated by env.validation.ts)
 * and exposed as a strongly-typed, nested config object consumed via
 * {@link AppConfigService}. Secrets are never logged.
 */
import { type DeploymentTier, resolveEnvironment } from './environment-guard';

export interface AppConfig {
  /** The Node runtime mode (NODE_ENV): how libraries and diagnostics behave. */
  env: 'development' | 'test' | 'production';
  /**
   * Which deployed environment this is (APP_ENV): whose data it may touch.
   *
   * Distinct from `env` because the development environment runs with
   * NODE_ENV=development while being a real deployment. See environment-guard.ts.
   */
  tier: DeploymentTier;
  /** True in any deployed environment; false on a developer's machine. */
  isDeployed: boolean;
  isProduction: boolean;
  api: {
    port: number;
    publicUrl: string;
    webPublicUrl: string;
    corsOrigins: string[];
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  clerk: {
    publishableKey: string;
    secretKey: string;
    jwtKey: string | undefined;
    webhookSecret: string | undefined;
  };
  openai: {
    apiKey: string;
    realtimeModel: string;
    /**
     * Fleet-wide default Realtime voice, used when a company has not chosen one
     * of its own. A company's saved voice always wins — see
     * ReceptionistService.buildSessionConfig.
     */
    realtimeVoice: string;
    /** Realtime GA WebSocket endpoint; overridable for tests/proxies. */
    realtimeUrl: string;
    responsesModel: string;
    embeddingModel: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    mediaStreamUrl: string;
  };
  /**
   * AWS resource coordinates.
   *
   * There are deliberately no access keys here. Every environment that talks to
   * AWS gets its credentials from the provider chain the SDK already consults:
   * the ECS task role in production, and whatever `aws configure`/SSO left in
   * the environment locally. Threading a static key pair through application
   * config would give the process a second, weaker way to authenticate that the
   * task role makes unnecessary — and one that has to be rotated by hand.
   */
  aws: {
    region: string;
    s3RecordingsBucket: string;
    s3UploadsBucket: string;
    sqsQueueUrl: string | undefined;
    backgroundJobsInline: boolean;
  };
  push: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidSubject: string;
  };
  logLevel: string;
}

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true' || value === '1';
};

const toList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default (): AppConfig => {
  const env = (process.env.NODE_ENV ?? 'development') as AppConfig['env'];
  const { tier, isDeployed } = resolveEnvironment();

  const webPublicUrl = process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173';
  return {
    env,
    tier,
    isDeployed,
    // Stays keyed on NODE_ENV, not on the tier: this drives runtime behaviour
    // (Swagger's CSP, log formatting), which is what NODE_ENV is for. Anything
    // asking "which environment's data is this?" wants `tier`.
    isProduction: env === 'production',
    api: {
      port: Number(process.env.API_PORT ?? 4000),
      publicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',
      webPublicUrl,
      corsOrigins: toList(process.env.CORS_ORIGINS ?? 'http://localhost:5173'),
    },
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    redis: {
      // No localhost default. A missing REDIS_URL used to resolve to a machine
      // that is not running Redis, so the failure surfaced as a connection
      // refusal from the cache layer rather than as the configuration mistake
      // it is. Empty fails the same way DATABASE_URL does: loudly, naming the
      // variable.
      url: process.env.REDIS_URL ?? '',
    },
    clerk: {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? '',
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
      jwtKey: process.env.CLERK_JWT_KEY || undefined,
      webhookSecret: process.env.CLERK_WEBHOOK_SECRET || undefined,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
      realtimeVoice: process.env.OPENAI_REALTIME_VOICE || 'marin',
      realtimeUrl: process.env.OPENAI_REALTIME_URL ?? 'wss://api.openai.com/v1/realtime',
      responsesModel: process.env.OPENAI_RESPONSES_MODEL ?? 'gpt-4.1',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      mediaStreamUrl:
        process.env.TWILIO_MEDIA_STREAM_URL ?? 'ws://localhost:4000/v1/telephony/media-stream',
    },
    aws: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      s3RecordingsBucket: process.env.S3_BUCKET_RECORDINGS ?? 'rooferslabs-recordings-dev',
      s3UploadsBucket: process.env.S3_BUCKET_UPLOADS ?? 'rooferslabs-uploads-dev',
      sqsQueueUrl: process.env.SQS_QUEUE_URL || undefined,
      backgroundJobsInline: toBool(process.env.BACKGROUND_JOBS_INLINE, true),
    },
    push: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
      vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:support@rooferslabs.com',
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
};
