# Tech Stack: Flow State

## Core Technologies
- **Programming Language:** TypeScript
- **Build Tool:** Vite 6
- **UI Library:** React 19
- **Routing:** React Router 7 (client-side, `BrowserRouter`)
- **Styling:** Tailwind CSS with shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React
- **Device APIs:** Battery Status, Network Information, Geolocation (Haversine geofencing),
  Idle Detection, Device Motion, Screen Orientation, Page Visibility

## State & Data
- **State Management:** Zustand, persisted to `localStorage`
  - `useAppStore` — flows, day-plan blocks, logs, vault import/export
  - `useDeviceStore` — device sensor state
  - `useAuthStore` — AT Protocol OAuth session, published flows, network discovery
- **Backup:** "The Vault" — manual JSON export/import to the local filesystem
- **Backend:** None. There is no database and no server of our own.

## Identity & Federation
- **Protocol:** AT Protocol. Flows are `app.flowstate.flow` records on the user's PDS;
  installs are `app.flowstate.install` records.
- **Auth:** `@atproto/oauth-client-browser` (public client, PKCE/PAR/DPoP handled by the
  library). Client metadata at `public/oauth/client-metadata.json`.
- **Discovery:** Client-side crawl of the signed-in user's follow graph. No indexer.
- **Schemas:** Lexicon JSON under `src/lexicons/`; TypeScript types in `src/types/` are
  derived from them.

## Platform Integration
- **Apple Shortcuts:** via the `DEEP_LINK` trigger — Shortcuts opens a Flow State URL with
  query params, acting as the sensor on iOS where the Web APIs above are unavailable.

## Testing & Quality
- **Test Runner:** Vitest with happy-dom
- **Component Testing:** React Testing Library
- **Linting:** ESLint 9 (flat config), `typescript-eslint`, `eslint-plugin-react-hooks`
- **Type Checking:** `tsc --noEmit`

## Infrastructure
- **App Type:** Progressive Web App via `vite-plugin-pwa` (Workbox `generateSW`)
- **Deployment:** Cloudflare Workers static assets, configured in `wrangler.jsonc` and
  wired to the build by `@cloudflare/vite-plugin`. Deploys run automatically from
  Cloudflare's GitHub integration on push to `master`.

## Deliberately Not Used
Recorded so they don't get reintroduced by accident:

- **No native wrapper** (no Expo, no Capacitor) — see `constitution.md`, Iron Rule II.
- **No Next.js.** The app was migrated off it; it is a pure client-side SPA with no SSR.
- **No Firebase, no Genkit, no TanStack Query, no Vercel.** Earlier drafts of this file
  listed all four. None were ever part of the shipped app.
- **No analytics.**
