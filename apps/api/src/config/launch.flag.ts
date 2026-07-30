/**
 * Launch mode — the private-beta gate.
 *
 * Before launch, production stays deployed and healthy but the application is
 * reachable only by an allowlisted internal account. Everyone else gets the
 * launch page and no data at all.
 *
 * Pure and free of Nest so the policy can be unit-tested directly, matching
 * payments.flag.ts. Read once into typed config (configuration.ts) and enforced
 * in exactly one place (LaunchGateGuard) — there is no second copy of this
 * decision anywhere in the API.
 */

export type LaunchMode = 'private' | 'public';

/**
 * Resolve the effective launch mode.
 *
 * Two rules, in this order:
 *
 * 1. The gate applies to PRODUCTION ONLY. Local development and any future
 *    non-production tier are always `public`, so a developer never has to add
 *    themselves to an allowlist to run the app they are working on. This reads
 *    APP_ENV — the deployment tier — rather than NODE_ENV, which is
 *    `production` in every deployed environment and would therefore gate a
 *    future devstage as well.
 *
 * 2. In production, anything other than an explicit `public` is `private`.
 *    Failing closed matters: a typo, a dropped variable, or a task definition
 *    that lost the setting must leave the beta shut rather than silently
 *    opening the product to the world.
 */
export function resolveLaunchMode(env: NodeJS.ProcessEnv = process.env): LaunchMode {
  if (env.APP_ENV !== 'production') return 'public';
  return env.APP_LAUNCH_MODE === 'public' ? 'public' : 'private';
}

/**
 * Parse the internal allowlist.
 *
 * Comma-separated addresses, configured per environment — never a literal in
 * source. Normalised to lowercase and trimmed so that a stray space or a
 * capitalised address in configuration does not lock the operator out of their
 * own beta.
 *
 * Duplicates are collapsed; empties are dropped. An entry without an `@` is
 * discarded rather than kept as a value that can never match, so a malformed
 * list is visible at boot (via `internalUserCount`) instead of at 2am.
 */
export function parseInternalUsers(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.INTERNAL_USERS ?? '';
  return [
    ...new Set(
      raw
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0 && entry.includes('@')),
    ),
  ];
}

/**
 * Is this address allowed through the gate?
 *
 * Compared case-insensitively, because an identity provider may return an
 * address in different casing than it was configured with and "the beta locked
 * me out over a capital letter" is not a failure worth having.
 *
 * An empty allowlist admits nobody. That is deliberate: the alternative — an
 * empty list meaning "allow everyone" — turns a dropped environment variable
 * into a silent public launch.
 */
export function isInternalUser(email: string | null | undefined, allowlist: string[]): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
