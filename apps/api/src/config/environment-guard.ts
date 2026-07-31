/**
 * Which deployed environment this process is, and whether its configuration
 * belongs to that environment.
 *
 * `APP_ENV` is the deployment tier and is deliberately NOT `NODE_ENV`. The two
 * answer different questions:
 *
 *   NODE_ENV  how Node and its libraries should behave — verbose errors and
 *             pretty logs, or not.
 *   APP_ENV   which environment's data this process is allowed to touch.
 *
 * The development environment runs with NODE_ENV=development (it wants the
 * diagnostics) while still being a *deployed* environment whose configuration
 * must be validated in full. Collapsing the two would mean choosing between
 * useful logs and a configuration check, and the check would lose.
 *
 * Local development sets neither, and nothing here applies to it.
 */

export type DeploymentTier = 'development' | 'production';

const TIERS: readonly DeploymentTier[] = ['development', 'production'];

export interface ResolvedEnvironment {
  /** Which environment's resources this process expects to be wired to. */
  tier: DeploymentTier;
  /**
   * Whether this is a deployed environment at all. True when APP_ENV names a
   * tier, or when NODE_ENV is production. False on a laptop, where a missing
   * credential should be a warning rather than a refusal to start.
   */
  isDeployed: boolean;
}

export function resolveEnvironment(env: NodeJS.ProcessEnv = process.env): ResolvedEnvironment {
  const appEnv = env.APP_ENV?.trim().toLowerCase();

  if (appEnv) {
    if (!TIERS.includes(appEnv as DeploymentTier)) {
      // Guessing would mean applying one environment's rules to the other's
      // resources, which is the single thing this module exists to prevent.
      throw new Error(
        `APP_ENV='${env.APP_ENV}' is not a deployment tier. Use one of: ${TIERS.join(', ')}.`,
      );
    }
    return { tier: appEnv as DeploymentTier, isDeployed: true };
  }

  const isProduction = env.NODE_ENV === 'production';
  return { tier: isProduction ? 'production' : 'development', isDeployed: isProduction };
}

/**
 * Every AWS resource is named for the environment that owns it
 * (`rooferslabs-production-…`, `rooferslabs-development-…`), which makes a
 * crossed connection string something a machine can see rather than something a
 * person has to notice.
 *
 * Scanned rather than parsed on purpose: the marker appears in an RDS endpoint,
 * an ElastiCache endpoint, a bucket name and a queue URL, and a substring test
 * catches all four without a format assumption about any of them.
 */
const RESOURCE_VARIABLES = [
  'DATABASE_URL',
  'REDIS_URL',
  'S3_BUCKET_RECORDINGS',
  'S3_BUCKET_UPLOADS',
  'SQS_QUEUE_URL',
] as const;

const stackPrefix = (tier: DeploymentTier): string => `rooferslabs-${tier}`;

/** The tier a value's resource name says it belongs to, if it says anything. */
function owningTier(value: string): DeploymentTier | null {
  for (const tier of TIERS) {
    if (value.includes(stackPrefix(tier))) return tier;
  }
  return null;
}

export interface IsolationViolation {
  variable: string;
  belongsTo: DeploymentTier;
}

export function findIsolationViolations(
  tier: DeploymentTier,
  env: NodeJS.ProcessEnv = process.env,
): IsolationViolation[] {
  const violations: IsolationViolation[] = [];

  for (const variable of RESOURCE_VARIABLES) {
    const value = env[variable];
    if (!value) continue;

    const belongsTo = owningTier(value);
    // Unnamed resources — a local Postgres, a bucket from before this naming —
    // are not evidence of anything and are left alone.
    if (belongsTo && belongsTo !== tier) {
      violations.push({ variable, belongsTo });
    }
  }

  return violations;
}

/**
 * Refuses to boot a process wired to another environment's data.
 *
 * Fatal in both directions. Production reading development's database is an
 * outage; development writing production's is worse, and the fact that it would
 * be an accident is exactly why the process should not be the one to allow it.
 */
export function assertEnvironmentIsolation(
  tier: DeploymentTier,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const violations = findIsolationViolations(tier, env);
  if (violations.length === 0) return;

  const detail = violations.map((v) => `${v.variable} belongs to ${v.belongsTo}`).join('; ');

  throw new Error(
    `Environment isolation violated: APP_ENV=${tier} but ${detail}. ` +
      `This process would read and write another environment's data. ` +
      `Check the task definition and the Secrets Manager entry for this environment.`,
  );
}
