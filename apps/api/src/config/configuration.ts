/**
 * Typed application configuration.
 *
 * Values are read once from the environment (validated by env.validation.ts)
 * and exposed as a strongly-typed, nested config object consumed via
 * {@link AppConfigService}. Secrets are never logged.
 */
import { PaymentProvider } from '@rooferslabs/shared';
import { activePaymentProvider, isPaymentsEnabled } from './payments.flag';
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
  paypal: {
    clientId: string;
    clientSecret: string;
    /**
     * Which PayPal estate this process talks to. Decides the REST host, and
     * nothing else — the same code path serves both, so a sandbox run exercises
     * exactly what production will.
     */
    environment: 'sandbox' | 'live';
    /**
     * An explicitly configured webhook id, overriding the provisioned one.
     *
     * Optional. `billing:paypal:setup` registers the webhook and persists its id
     * in `billing_catalog`, so this is normally empty — it exists for a webhook
     * registered by hand, or one shared across deployments, which the
     * provisioner must then leave alone.
     *
     * Not a secret and not a signing key: PayPal verifies a delivery by having
     * us POST the headers and body back to it along with this id, so possession
     * of it proves nothing on its own.
     */
    webhookId: string;
    /**
     * Charge the token test price instead of the published one.
     *
     * When true, a checkout for the Founding Customer monthly plan resolves to
     * the separately provisioned `$1.00` PayPal plan rather than the `$49.00`
     * one. Nothing else changes: the product still advertises $49 everywhere,
     * the subscription lifecycle is identical, and webhooks, activation and
     * entitlement are untouched. The customer sees the real amount for the first
     * time on PayPal's own approval page.
     *
     * It exists because a sandbox subscription proves the code path and nothing
     * else — not live credentials, not live webhook signature verification, and
     * not money actually arriving in the bank. This proves those for a dollar.
     *
     * Two consequences worth knowing before enabling it on a live account:
     *
     *  - Subscriptions created while it is on **keep billing $1 on renewal**.
     *    Turning it off changes what new checkouts charge, not what existing
     *    subscriptions bill — moving those is a plan revision per subscription.
     *  - The API logs an error-level line at boot for as long as it is on.
     */
    testPricing: boolean;
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

  /**
   * One variable, one switch, no half-enabled state.
   *
   * The alternative — a plan id plus an `ENABLED` boolean — has a state where
   * the id is set and the boolean says otherwise, and the cost of being wrong
   * about which one won is charging real cards the wrong amount. A single
   * boolean against a provisioned plan cannot get into that state.
   */
  const testPricing = toBool(process.env.PAYPAL_TEST_PRICING, false);

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
      webPublicUrl: process.env.WEB_PUBLIC_URL ?? 'http://localhost:5173',
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
    payments: {
      enabled: isPaymentsEnabled(),
      provider: activePaymentProvider(),
      // PayPal attaches trials to the plan itself, so a non-zero value here is
      // warned about and ignored by the adapter — see PayPalProvider.
      trialPeriodDays: Number(process.env.BILLING_TRIAL_PERIOD_DAYS ?? 0),
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
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID ?? '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
      // Anything other than an explicit 'live' is treated as sandbox, so a typo
      // bills nobody rather than charging real cards against a half-configured
      // account.
      environment: process.env.PAYPAL_ENVIRONMENT === 'live' ? 'live' : 'sandbox',
      webhookId: process.env.PAYPAL_WEBHOOK_ID ?? '',
      testPricing,
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
