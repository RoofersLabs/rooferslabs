/**
 * Typed application configuration.
 *
 * Values are read once from the environment (validated by env.validation.ts)
 * and exposed as a strongly-typed, nested config object consumed via
 * {@link AppConfigService}. Secrets are never logged.
 */
import { isPaymentsEnabled } from './payments.flag';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
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
  payments: {
    /**
     * Master switch for the billing feature. When false the Stripe client is
     * never constructed, the webhook route is not registered, the billing
     * endpoints answer 503, and the payment wall is open — every tenant reaches
     * the product without a subscription.
     */
    enabled: boolean;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    /** Stripe Price IDs (recurring) backing each self-serve plan. */
    prices: {
      STARTER: string;
      PROFESSIONAL: string;
    };
    /** Free-trial length applied to new checkout sessions; 0 disables trials. */
    trialPeriodDays: number;
    /**
     * Companies created strictly before this instant are exempt from the
     * payment wall. Null means no exemption: every tenant pays.
     */
    grandfatherBefore: Date | null;
  };
  openai: {
    apiKey: string;
    realtimeModel: string;
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

  return {
    env,
    isProduction: env === 'production',
    api: {
      port: Number(process.env.API_PORT ?? 4000),
      publicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',
      webPublicUrl: process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173',
      corsOrigins: toList(process.env.CORS_ORIGINS ?? 'http://localhost:5173'),
    },
    database: {
      url: process.env.DATABASE_URL ?? '',
    },
    redis: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
    clerk: {
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? '',
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
      jwtKey: process.env.CLERK_JWT_KEY || undefined,
      webhookSecret: process.env.CLERK_WEBHOOK_SECRET || undefined,
    },
    payments: {
      enabled: isPaymentsEnabled(),
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      prices: {
        STARTER: process.env.STRIPE_PRICE_STARTER ?? '',
        PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
      },
      trialPeriodDays: Number(process.env.STRIPE_TRIAL_PERIOD_DAYS ?? 0),
      /**
       * Companies created strictly before this instant keep full access without
       * paying; everyone who signs up afterwards hits the payment wall as
       * normal. Unset (the default) means no exemption at all — the cutoff has
       * to be turned on deliberately, so a missing or malformed value can never
       * silently hand the product away for free.
       */
      grandfatherBefore: (() => {
        const raw = process.env.BILLING_GRANDFATHER_BEFORE;
        if (!raw) return null;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      })(),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime',
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
