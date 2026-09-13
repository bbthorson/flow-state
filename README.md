# Flow State

An Android-first PWA for on-device automations. It connects device triggers (battery,
network, geolocation, idle, motion, orientation, schedule) to actions (webhooks,
notifications, vibration, clipboard, share, wake lock, speech).

Everything runs locally in the browser. Nothing is sent to a server unless you add a
webhook action or sign in to publish flows.

## Core ideas

1. **Local-first.** Flows, day-plan blocks, and logs live in `localStorage`. No analytics,
   no backend of our own.
2. **Web native.** Built on standard Web APIs — no app store, no native wrapper.
3. **Federated, not centralised.** Sharing flows is optional and runs over AT Protocol:
   flows are records on *your* PDS, and discovery crawls your follow graph client-side.
   There is no indexer in the middle.

## Capabilities

### Triggers

| Trigger | Notes |
| --- | --- |
| `NATIVE_BATTERY` | Level thresholds, charging state |
| `NETWORK` | Online/offline, connection type changes |
| `GEOLOCATION` | Enter/exit a radius |
| `IDLE` | Idle Detection API |
| `DEVICE_MOTION` | Accelerometer thresholds |
| `SCREEN_ORIENTATION` | Portrait/landscape, face up/down |
| `TIME` | Time-of-day schedule |
| `DEEP_LINK` | External trigger via URL params (used by Apple Shortcuts) |
| `MANUAL` | Run from the UI |

### Actions

`WEBHOOK` (POST/GET with data templating) · `NOTIFICATION` · `LOG` · `VIBRATION` ·
`CLIPBOARD` · `WEB_SHARE` · `WAKE_LOCK` · `SPEECH`

### Known limits

- **The `TIME` trigger only fires while the app is in the foreground.** A PWA cannot wake
  itself in the background; this is a platform constraint, not a bug.
- iOS restricts several of the sensor APIs above. The `DEEP_LINK` trigger exists so Apple
  Shortcuts can act as the sensor and hand data to Flow State.
- Browsers evict storage for unused sites. Use **Vault** (Control drawer → Settings) to
  export a JSON backup.

## Stack

- **Build:** Vite 6
- **UI:** React 19, React Router 7, Tailwind CSS, shadcn/ui (Radix primitives)
- **State:** Zustand, persisted to `localStorage`
- **PWA:** `vite-plugin-pwa` (Workbox `generateSW`)
- **Identity/sharing:** AT Protocol via `@atproto/oauth-client-browser`
- **Hosting:** Cloudflare Workers static assets (`wrangler.jsonc`)

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:9002
```

No environment variables are needed for local development. The app has no secrets — the
AT Protocol client is a public OAuth client described by
`public/oauth/client-metadata.json`.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on port 9002 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Build, then serve via `wrangler dev` |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Deployment

Cloudflare's GitHub integration deploys on push to `master`. It runs `npm run build`, then
`npx wrangler versions upload` against `wrangler.jsonc` (a static-assets Worker named
`flow-state` with SPA fallback). There is no manual deploy step.

## Repo layout

```
src/
  components/   UI, including the compass shell and its drawers
    ui/         shadcn/ui primitives (re-add more with `npx shadcn@latest add <name>`)
  hooks/        Device sensor hooks + useFlowTriggerManager
  lexicons/     AT Protocol lexicon JSON (app.flowstate.*)
  lib/          OAuth client, permissions registry, schedule/block helpers
  routes/       Page components
  services/     Action executors, AT Protocol operations
  store/        Zustand stores (app, device, auth)
  types/        Types derived from the lexicons
docs/
  kairos-roadmap.md   Where this is going (Phases 1–4)
  archive/            Superseded specs, kept for history
conductor/      Product notes and past work tracks
constitution.md Non-negotiable product principles
CLAUDE.md       Conventions for AI assistants working in this repo
```

## License

MIT
