/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  /** Deployment tier. Mirrors the API's APP_ENV; see __APP_ENV__ below. */
  readonly VITE_APP_ENV?: 'production' | 'development';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injected by Vite from package.json — see `define` in vite.config.ts. */
declare const __APP_VERSION__: string;

/**
 * Deployment tier, resolved at build time from VITE_APP_ENV.
 *
 * Anything unrecognised — including it being unset — becomes 'development', so
 * a build acquires production behaviour only by naming it. Also namespaces the
 * service worker's Cache Storage buckets, which is why it is baked in at build
 * time rather than read from import.meta.env at runtime.
 */
declare const __APP_ENV__: 'production' | 'development';
