import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { createRequire } from "module";

// Read the version at build time so the About panel can't drift from package.json.
const { version } = createRequire(import.meta.url)("./package.json");

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  fmt: {
    ignorePatterns: ["dist/**", "dev-dist/**", "docs/**", "conductor/**", "src/components/ui/**", "public/sw.js"],
  },
  lint: {
    ignorePatterns: ["dist/**", "dev-dist/**", "docs/**", "conductor/**", "src/components/ui/**", "public/sw.js"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    // Vitest v4 compatibility: preserve mock call history.
    clearMocks: false,
  },
  plugins: lazyPlugins(() => [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      manifest: {
        name: "Flow State",
        short_name: "Flow State",
        description:
          "Local-first deterministic automations and Context Spaces for the open web.",
        theme_color: "#F8F6F2",
        background_color: "#F8F6F2",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-256x256.png", sizes: "256x256", type: "image/png" },
          { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
    cloudflare(),
  ]),
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Chunking is left entirely to Rollup. The AT Protocol client is pulled in via
  // dynamic import (see src/lib/atproto.ts), so it splits into its own async
  // chunk on its own. Forcing it into a manualChunk actively hurt: Rollup hoisted
  // shared helpers (including Vite's preload helper) into the forced chunk, which
  // put a *static* edge from the entry chunk back to it and defeated the lazy load.
});
