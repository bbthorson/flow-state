# Flow State

A local-first, deterministic automation engine and Context-First PWA for the open web.

Flow State treats **flows as app primitives**: organize deterministic functions from your device and invited AT Protocol apps or bridges into focused **Contexts** (backed by AT Protocol Spaces), rendered as calm, brand-stripped cards and schema-driven action forms.

## Core Principles

1. **Local-first & Sovereign.** Flows, contexts, day blocks, run traces, and Tier-0 secrets live in IndexedDB on your device. Secrets never leave the device—even when syncing or exporting a Vault backup.
2. **Deterministic & Transparent ("No Magic").** Every trigger evaluation and step execution produces a structured `RunTrace` waterfall. Test any flow safely with the Live Dry-Run Simulator before activating it.
3. **Private Spaces by Default.** Your Personal Space stays strictly yours. External apps and bridges (by AT Protocol DID) are invited into scoped Context Spaces where they exchange typed `Event`s and `Command`s.
4. **Optional, Self-Hostable Hub.** The PWA works 100% locally with no server. Enable the included Cloudflare Worker + Durable Object Hub (`apps/hub`) for revocable HTTPS inboxes, Web Push wakeups into the Service Worker, and opt-in always-on Space-to-Space flows.

## Architecture

| Layer | Package | Responsibility |
| --- | --- | --- |
| **1. Pure Core** | `packages/core` | 7 primitives (`Event`, `Capability`, `Command`, `Flow`, `Context/Block`, `Checkpoint/RunTrace`, `SecretRef/TrustLevel`), taint tracker, pure deterministic engine, Zod trust boundaries, ATProto lexicons |
| **2. Adapters** | `packages/adapters` | Pluggable `CapabilityAdapter`s for browser sensors, local actions, platform capability probe, ATProto Space participants, and Reference Bridge DIDs |
| **3. Runtime** | `packages/runtime` | Headless `RuntimeHost`, IndexedDB storage (shared with Service Worker), persisted edge-trigger state, checkpoint scheduler, legacy `localStorage` migration |
| **4. Surface** | `src/vnext/` | Thin React 19 + Radix UI Context-First PWA (`ContextHome`, `PipelineEditor`, `TraceViewer`) + Service Worker push executor (`src/sw.ts`) |
| **Optional Hub** | `apps/hub` | Cloudflare Worker + `UserHubDO` Durable Object (`/hub/e/:token`, Web Push fan-out, opt-in Hub runner) |

## Getting Started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:9002 (Vite+)
```

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite+ dev server on port 9002 |
| `npm run build` | Production build (`vp build`) to `dist/` |
| `npm run preview` | Build and serve via `wrangler dev` |
| `npm test` | Run all Vitest suites (`vp test --run`) |
| `npm run check` | Oxfmt + Oxlint + `tsgo` (`vp check`) |
| `npm run lint` | Oxlint + `tsgo` (`vp lint`) |

## Deployment

Cloudflare's GitHub integration builds with `npm run build` (`vp build`) and deploys via `wrangler.jsonc` (serving static PWA assets alongside `/hub/*` Worker routes and the `UserHubDO` Durable Object).

## License

MIT
