/**
 * Typed application configuration.
 *
 * Values are read once from the environment (validated by env.validation.ts)
 * and exposed as a strongly-typed, nested config object consumed via
 * {@link AppConfigService}. Secrets are never logged.
 */
import { BillingInterval, PaymentProvider, SubscriptionPlan } from '@rooferslabs/shared';
import { activePaymentProvider, isPaymentsEnabled } from './payments.flag';

/**
 * Price identifiers for every plan/interval a provider offers.
 *
 * An empty string means "not sold": annual pricing ships unconfigured, and the
 * provider adapter refuses a checkout for a combination with no price rather
 * than inventing one. That is what makes annual plans a dashboard-and-env
 * change rather than a code change.
 */
export type PriceTable = Record<SubscriptionPlan, Record<BillingInterval, string>>;

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
     * Master switch for the billing feature. When false no provider client is
     * ever constructed, no webhook route is registered, the billing endpoints
     * answer 503, and the payment wall is open — every tenant reaches the
     * product without a subscription.
     */
    enabled: boolean;
    /**
     * The processor that handles money. Exactly one is active; the others are
     * compiled but never constructed and refuse every call.
     */
    provider: PaymentProvider;
    /** Free-trial length applied to new checkouts; 0 disables trials. */
    trialPeriodDays: number;
    /**
     * Companies created strictly before this instant are exempt from the
     * payment wall. Null means no exemption: every tenant pays.
     *
     * Provider-independent by design — the exemption is a fact about when a
     * tenant signed up, so it must survive a change of processor.
     */
    grandfatherBefore: Date | null;
  };
  paddle: {
    apiKey: string;
    /**
     * The browser-side token Paddle.js initializes with. Public by design — it
     * identifies the seller account and can only open checkouts, never read or
     * mutate anything. Served to the frontend from /v1/billing/config rather
     * than baked into the bundle, so rotating it does not need a rebuild.
     */
    clientToken: string;
    webhookSecret: string;
    environment: 'sandbox' | 'production';
    prices: PriceTable;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    prices: PriceTable;
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
      provider: activePaymentProvider(),
      // BILLING_TRIAL_PERIOD_DAYS supersedes the Stripe-specific name it grew
      // up under; the old variable is still read so an environment that has not
      // been updated yet keeps the trial length it was configured with.
      trialPeriodDays: Number(
        process.env.BILLING_TRIAL_PERIOD_DAYS ?? process.env.STRIPE_TRIAL_PERIOD_DAYS ?? 0,
      ),
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
    paddle: {
      apiKey: process.env.PADDLE_API_KEY ?? '',
      clientToken: process.env.PADDLE_CLIENT_TOKEN ?? '',
      webhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? '',
      // Anything other than an explicit 'production' is treated as sandbox, so
      // a typo bills nobody rather than charging real cards against a
      // half-configured account.
      environment: process.env.PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
      prices: {
        [SubscriptionPlan.STARTER]: {
          [BillingInterval.MONTH]: process.env.PADDLE_PRICE_STARTER_MONTHLY ?? '',
          [BillingInterval.YEAR]: process.env.PADDLE_PRICE_STARTER_ANNUAL ?? '',
        },
        [SubscriptionPlan.PROFESSIONAL]: {
          [BillingInterval.MONTH]: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY ?? '',
          [BillingInterval.YEAR]: process.env.PADDLE_PRICE_PROFESSIONAL_ANNUAL ?? '',
        },
      },
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      prices: {
        [SubscriptionPlan.STARTER]: {
          [BillingInterval.MONTH]: process.env.STRIPE_PRICE_STARTER ?? '',
          [BillingInterval.YEAR]: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? '',
        },
        [SubscriptionPlan.PROFESSIONAL]: {
          [BillingInterval.MONTH]: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
          [BillingInterval.YEAR]: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL ?? '',
        },
      },
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
