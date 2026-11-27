# Flow State

A local-first, deterministic automation engine and Context-First PWA for the open web. Organize functions from your device and invited AT Protocol apps/bridges into focused **Contexts** (backed by AT Protocol Spaces), rendered as calm, brand-stripped cards and schema-driven app primitives.

## Stack & Toolchain

- **Toolchain:** Vite+ (`vp` CLI) — Rolldown bundler, Vitest 5, Oxlint, Oxfmt, `tsgo`
- **Workspaces:** npm workspaces (`packages/*`, `apps/*`)
- **UI (Layer 4):** React 19, Tailwind CSS, shadcn/ui (Radix primitives)
- **Persistence:** IndexedDB (`IndexedDBStorage` in `@flowstate/runtime`, with automatic one-time migration from legacy `localStorage['flow-state-v2']`)
- **PWA:** `vite-plugin-pwa` (`injectManifest`) with custom Service Worker push executor (`src/sw.ts`)
- **Hosting & Optional Hub:** Cloudflare Workers + Durable Objects (`wrangler.jsonc`)

## Commands

- `npm run dev` — Vite+ dev server on port 9002 (`vp dev --port 9002`)
- `npm run build` — Production build (`vp build`)
- `npm test` — Run all Vitest suites (`vp test --run`)
- `npm run check` — Format, lint, and typecheck (`vp check`)
- `npm run lint` — Oxlint + `tsgo` type-aware lint (`vp lint`)
- `npm run preview` — Build and serve locally via `wrangler dev`

## 4-Layer Architecture & The 7 Primitives

Keep dependencies strictly downward: `Layer 4 (UI)` → `Layer 3 (Runtime/Hub)` → `Layer 2 (Adapters)` → `Layer 1 (Core)`.

1. **Layer 1 — Pure Core (`packages/core`, `@flowstate/core`)**
   - **Zero React, zero browser APIs, zero network I/O.** Runs identically in Browser, Service Worker, Cloudflare Hub Durable Objects, and tests.
   - **7 Primitives (`src/primitives.ts`):** `Event`, `Capability`, `Command`, `Flow`, `Context`/`Block`, `Checkpoint`/`RunTrace`, `SecretRef`/`TrustLevel`.
   - **Taint & Tier-0 Secrets (`src/taint.ts`):** External/space/deep-link events carry `trust: 'untrusted'`. Untrusted roots (and variables derived from them) are blocked from `sensitive` command inputs (e.g., Webhook URLs/headers). `{{secrets.*}}` placeholders are never materialized in `Command.input`, `Checkpoint`, or `RunTrace` — only resolved from Tier-0 storage at adapter dispatch time.
   - **Pure Engine (`src/engine.ts`):** `matchesEvent` (supports stateful `edgeTriggered` transitions), `executeFlow`, `resumeCheckpoint` (`delay` and `awaitReply` correlated Space replies), `dryRun`, and `MAX_EVENT_HOPS` (5).
   - **Trust Boundary (`src/schema.ts`):** Zod parsers (`parseEvent`, `parseCapability`, `parseCommand`, `parseFlow`, `parseContext`, `parseBlock`, `parseCheckpoint`). Everything arriving from a Space, Hub inbox, or Vault import MUST pass through these.
   - **Unified Lexicons (`packages/core/lexicons/app/flowstate/`):** `capability`, `command`, `block`, `space.personal`, `space.context`.

2. **Layer 2 — Capability Adapters (`packages/adapters`, `@flowstate/adapters`)**
   - Uniform `CapabilityAdapter` plugin contract (`manifest`, `start`, `stop`, `getSnapshot`, `execute`).
   - Built-in device sensors (`device.battery`, `device.network`) and local actions (`local.webhook`, `local.notification`, `local.clipboard`, `local.event`, `local.log`).
   - `platform.ts`: transparent Android/iOS/Desktop capability matrix probe.
   - `atproto-space.ts`: `SpaceTransport` abstraction, `createSpaceParticipantAdapter` (invited App/Bridge DIDs), and `createReferenceBridge`.

3. **Layer 3 — Headless Runtime (`packages/runtime`, `@flowstate/runtime`)**
   - `storage.ts`: `RuntimeStorage` interface with `IndexedDBStorage` (shared by PWA + Service Worker) and `MemoryStorage` (tests), plus `migrateLegacyLocalStorage`.
   - `host.ts`: `RuntimeHost` owns the event bus, persisted `triggerState` (edge transitions survive reloads), `Checkpoint` scheduler, Day Block → Context transitions, Tier-0 `secrets`, structured `RunTrace`s, and Vault export/import. Exposes `subscribe`/`getSnapshot` for React `useSyncExternalStore`.

4. **Layer 4 — Context-First PWA Surface (`src/vnext/`, `src/App.tsx`)**
   - Thin reactive view over `getRuntimeHost()` (instantiated outside React in `src/vnext/runtime.ts`, including deep-link query-param ingest).
   - **Rule:** Never put sensor hooks, `localStorage` writes, or execution logic inside React components.
   - `ContextHome.tsx`: Active Focus Context, pinned App Primitives (with schema-driven form sheet), Context Stream, Day Plan linked to Contexts, App DID invitations, Capability Matrix, and Vault backup with 6-day staleness warning.
   - `PipelineEditor.tsx`: Visual `WHEN → IF → DO` editor with taint-aware token pills and Live Dry-Run Simulator.
   - `TraceViewer.tsx`: Step-by-step `RunTrace` waterfall ("No Magic").

5. **Optional Cloudflare Hub (`apps/hub`, `@flowstate/hub`)**
   - Worker + per-user `UserHubDO` Durable Object bound in `wrangler.jsonc` under `/hub/*`.
   - Handles revocable per-sender HTTPS inboxes (`POST /hub/e/:senderToken`), Web Push subscription registry + fan-out, and opt-in Hub execution (`executionTarget: 'hub'`) reusing `@flowstate/core`.

## UI Conventions

- Android-first — test layouts at mobile widths (`max-w-lg`)
- No emojis in UI unless requested; use `lucide-react` icons consistently
- Keep `src/components/ui/` to only the shadcn/ui primitives actively in use
- Personal Spaces are strictly private (no external apps invited); external apps/bridges are invited into Context Spaces
