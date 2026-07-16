import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'RoofersLabs',
        short_name: 'RoofersLabs',
        description: 'AI Front Office for roofing companies — never miss a call.',
        theme_color: '#1E40AF',
        background_color: '#0B1220',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
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
            urlPattern: ({ url }) => url.pathname.startsWith('/icons/'),
            handler: 'CacheFirst',
            options: { cacheName: 'icons', expiration: { maxEntries: 20 } },
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
