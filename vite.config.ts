import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { createRequire } from 'module';

// Read the version at build time so the About panel can't drift from package.json.
const { version } = createRequire(import.meta.url)('./package.json');

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    manifest: {
      name: 'Flow State',
      short_name: 'Flow State',
      description: 'On-device automations that connect device events to actions. Runs entirely in your browser — your data never leaves your device.',
      theme_color: '#F8F6F2',
      background_color: '#F8F6F2',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
        { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: '/index.html',
    },
  }), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Chunking is left entirely to Rollup. The AT Protocol client is pulled in via
  // dynamic import (see src/lib/atproto.ts), so it splits into its own async
  // chunk on its own. Forcing it into a manualChunk actively hurt: Rollup hoisted
  // shared helpers (including Vite's preload helper) into the forced chunk, which
  // put a *static* edge from the entry chunk back to it and defeated the lazy load.
});
