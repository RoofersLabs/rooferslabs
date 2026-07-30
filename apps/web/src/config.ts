/**
 * Frontend runtime configuration, sourced from Vite env vars and validated once
 * at module load. Misconfiguration surfaces loudly (see `configErrors`, rendered
 * by AppProviders) instead of failing silently deep inside an API call.
 *
 * See apps/web/.env.example for setup guidance.
 */

interface ValidatedConfig {
  /** API origin. Empty ONLY in development, where the Vite proxy forwards /v1
   *  to the local API. Production always resolves to an absolute origin. */
  apiBaseUrl: string;
  /** Clerk publishable key (pk_test_… / pk_live_…). */
  clerkPublishableKey: string;
  /** Human-readable configuration problems that must block the app from booting. */
  configErrors: string[];
}

function validateConfig(): ValidatedConfig {
  const errors: string[] = [];
  const isProd = import.meta.env.PROD;

  // The deployment TIER, read from the env var rather than the __APP_ENV__
  // define. Vite substitutes `define` values only when it bundles — a module
  // served by the dev server still contains the bare identifier, so referencing
  // it here directly throws a ReferenceError at import time and blanks the app.
  // import.meta.env is populated in both dev and build, and this file already
  // reads everything else that way.
  //
  // Distinct from import.meta.env.PROD above, which is the BUILD mode.
  const appEnv = import.meta.env.VITE_APP_ENV ?? 'development';

  // ── Clerk publishable key — required in every environment ────────────────
  const clerkPublishableKey =
    (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() ?? '';
  if (!clerkPublishableKey) {
    errors.push(
      'VITE_CLERK_PUBLISHABLE_KEY is not set. Add your Clerk publishable key ' +
        '(Clerk Dashboard → API Keys) to apps/web/.env.',
    );
  } else if (!clerkPublishableKey.startsWith('pk_')) {
    errors.push(
      'VITE_CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key (expected pk_…).',
    );
  } else if (appEnv !== 'production' && clerkPublishableKey.startsWith('pk_live_')) {
    // The publishable key is not merely a credential — it ENCODES the Clerk
    // Frontend API host, which is what clerk-js is fetched from. A pk_live_ key
    // base64-decodes to `clerk.rooferslabs.com`, so a development build holding
    // one silently loads the PRODUCTION Clerk instance and authenticates against
    // the live user directory. There is no proxyUrl or domain prop involved and
    // nothing visible in the code to explain it; the only evidence is the script
    // origin in the network tab.
    //
    // Refusing to boot is therefore the only way this is noticeable at all.
    errors.push(
      'VITE_CLERK_PUBLISHABLE_KEY is a Clerk PRODUCTION key (pk_live_…) in a ' +
        `${appEnv} build. That key encodes the production Clerk Frontend API ` +
        'host, so the app would load clerk-js from clerk.rooferslabs.com and sign ' +
        'users in against the LIVE user directory. Use the Development instance ' +
        'key (pk_test_…) — Clerk Dashboard → instance selector → Development → ' +
        'API Keys — or re-run `bun run setup` to re-sync it from .env.',
    );
  }

  // ── API base URL — absolute origin in production; empty in dev (Vite proxy)
  // In production the SPA is served by CloudFront, which maps unknown paths to
  // index.html (SPA routing), so a same-origin /v1 call would return the SPA
  // shell rather than the API. The absolute origin (api.<domain>) is therefore
  // mandatory for prod builds — never fall back silently.
  const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
  let apiBaseUrl = '';
  if (!rawApiBaseUrl) {
    if (isProd) {
      errors.push(
        'VITE_API_BASE_URL is not set. Production builds must point at the API origin, ' +
          'e.g. https://api.rooferslabs.com. It may be empty only in development, where the ' +
          'Vite proxy forwards /v1 to the local API.',
      );
    }
    // dev: leave empty so requests resolve same-origin and hit the Vite proxy.
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(rawApiBaseUrl);
    } catch {
      errors.push(`VITE_API_BASE_URL is not a valid URL: "${rawApiBaseUrl}".`);
    }
    if (parsed) {
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push(`VITE_API_BASE_URL must use http(s), got "${parsed.protocol}".`);
      } else {
        // Strip trailing slashes so `${base}/v1${path}` never doubles them, and
        // catch the common mistake of baking the /v1 prefix into the origin.
        const normalized = rawApiBaseUrl.replace(/\/+$/, '');
        if (/\/v1$/i.test(normalized)) {
          errors.push(
            'VITE_API_BASE_URL should be the API origin only, without the trailing /v1 ' +
              '(the client adds /v1 to every request).',
          );
        } else {
          apiBaseUrl = normalized;
        }
      }
    }
  }

  return { apiBaseUrl, clerkPublishableKey, configErrors: errors };
}

export const config = validateConfig();
