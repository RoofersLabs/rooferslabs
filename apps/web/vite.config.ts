import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { createRequire } from 'node:module';

// The admin portal reports the running version; reading it from package.json
// keeps one source of truth rather than a second string to forget to bump.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

// Deployment tier, mirroring the API's APP_ENV. Set by infra/scripts/dev-env.sh
// locally and by deploy-web.sh for a production build. Anything unrecognised —
// including it being absent — resolves to development, so a build only gets
// production behaviour by asking for it, never by accident.
//
// Read at config time rather than through import.meta.env because it has to
// name the service-worker cache buckets, which are baked into the generated SW.
const appEnv = process.env.VITE_APP_ENV === 'production' ? 'production' : 'development';

// Private-beta fallback, used only when the SPA cannot reach the API — the API
// is authoritative and is read at runtime. Baked in as a define rather than
// read from import.meta.env so the module compiles under ts-jest too.
const launchMode = process.env.VITE_APP_LAUNCH_MODE === 'private' ? 'private' : 'public';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_ENV__: JSON.stringify(appEnv),
    __APP_LAUNCH_MODE__: JSON.stringify(launchMode),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'rooferslabs',
        short_name: 'rooferslabs',
        description: 'AI Front Office for roofing companies — never miss a call.',
        theme_color: '#081C3A',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        // Launch into the product, not the marketing site: '/' is the public
        // landing page, so an installed app opened there showed a signed-in
        // owner the sales pitch. The route guard still turns a signed-out
        // launch toward sign-in, and returns them here afterwards.
        start_url: '/dashboard',
        // Pinned because the manifest identity defaults to `start_url` when
        // absent. Without it, moving start_url would make browsers treat this
        // as a brand-new app — offering a duplicate install and stranding
        // anyone who installed the earlier build.
        id: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Web Push handlers live in public/push-sw.js (payload display + click
        // routing); Workbox imports them into the generated service worker.
        importScripts: ['push-sw.js'],

        // Namespace every Cache Storage bucket by environment AND build.
        //
        // Environment: a future devstage.rooferslabs.com is a different origin,
        // so the browser already separates them — but an environment is also
        // reachable at localhost during development, and a developer who has
        // visited production shares an origin with nothing yet still benefits
        // from caches that are obviously labelled. Explicit beats incidental.
        //
        // Build: the version suffix means a release cannot inherit the previous
        // release's cached responses. Workbox deletes buckets whose cacheId no
        // longer matches, so old ones are cleaned up rather than accumulating.
        cacheId: `rooferslabs-${appEnv}-v${version}`,

        // Explicitly OFF. vite-plugin-pwa defaults this to 'index.html', which
        // registers a NavigationRoute bound to the precache — and Workbox
        // matches routes in registration order, first match wins. Because that
        // injected route is registered ahead of anything in runtimeCaching,
        // leaving it in place silently shadows the NetworkFirst rule below and
        // every navigation is served from the precache after all.
        //
        // The trade-off: an offline navigation to a route never visited before
        // now fails instead of rendering the cached shell. That is the right way
        // round for a dashboard that cannot show anything useful without the
        // network anyway, and it is the only way to guarantee a navigation
        // response carries the CDN's current security headers rather than
        // whichever ones were current when the shell was cached.
        navigateFallback: undefined,

        // Never cache API calls — always hit the network for fresh business data.
        navigateFallbackDenylist: [/^\/v1\//],

        runtimeCaching: [
          {
            // Navigations go to the NETWORK first, with the cache as an offline
            // fallback only.
            //
            // This replaces `navigateFallback: '/index.html'`, which served
            // every navigation from the precache. The Cache API stores complete
            // Response objects — headers included — so a precached document
            // replays the security headers that CloudFront sent when it was
            // cached, and the browser enforces those. A CDN-side header change
            // (a CSP that newly allows cdn.paddle.com, say) then never reaches
            // a returning visitor, because Workbox only refetches a precached
            // entry when its content revision changes and a header-only change
            // does not touch index.html at all. That is not hypothetical: it is
            // why Paddle checkout stayed blocked in real browsers after the CSP
            // was corrected at the edge and verified correct over curl.
            //
            // NetworkFirst costs one conditional request per navigation — the
            // document is `no-cache` at the CDN anyway, so it was already
            // revalidating — and guarantees headers can never go stale.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html',
              networkTimeoutSeconds: 3, // fall back to cache on a dead network
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Icons are served from stable, unhashed names, so CacheFirst with
            // no age limit would pin a replaced icon in the SW cache forever.
            // 30 days bounds how long a stale icon can survive.
            urlPattern: ({ url }) => url.pathname.startsWith('/icons/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'icons',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          clerk: ['@clerk/clerk-react'],
          data: ['@tanstack/react-query', 'zustand', 'zod', 'react-hook-form'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
