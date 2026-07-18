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
  }

  // ── API base URL — absolute origin in production; empty in dev (Vite proxy)
  // In production Vercel rewrites every path to index.html, so a same-origin
  // /v1 call would return the SPA shell rather than the API. The absolute
  // origin is therefore mandatory for prod builds — never fall back silently.
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
