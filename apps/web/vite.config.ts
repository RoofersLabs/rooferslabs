import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { createRequire } from 'node:module';

// The admin portal reports the running version; reading it from package.json
// keeps one source of truth rather than a second string to forget to bump.
const { version } = createRequire(import.meta.url)('./package.json') as { version: string };

// https://vitejs.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
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
        navigateFallback: '/index.html',
        // Never cache API calls — always hit the network for fresh business data.
        navigateFallbackDenylist: [/^\/v1\//],
        runtimeCaching: [
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
