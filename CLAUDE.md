# Flow State

An Android-first PWA for on-device automations. Connects device triggers (battery, network, geolocation, idle, motion, orientation) to actions (webhooks, notifications, vibration, clipboard, share, wake lock, speech). Everything runs locally — no server unless the user adds a webhook action.

## Stack

- Vite + React 19 + React Router
- Shadcn/ui components (Radix primitives + Tailwind)
- Zustand for state (persisted to localStorage)
- Deployed to Cloudflare Workers
- AT Protocol lexicon schemas define the flow format

## Commands

- `npm run dev` — local dev server (port 9002)
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
- `npm test` — Vitest test suite
- `npm run lint` — ESLint

## Deployment

Deploys are handled by Cloudflare's GitHub integration — pushing to `master` triggers a build and deploy automatically. There is no local `wrangler` config or `deploy` script.

## Architecture

- `src/types/` — Core types derived from lexicon schemas
- `src/lexicons/` — AT Protocol lexicon JSON files (app.flowstate.flow, app.flowstate.install, triggers, actions)
- `src/store/useAppStore.ts` — Zustand store for flows, logs, vault import/export (persisted to localStorage)
- `src/store/useDeviceStore.ts` — Zustand store for device sensor state
- `src/store/useAuthStore.ts` — Zustand store for AT Protocol OAuth (did, handle, published flows map, network discovery)
- `src/hooks/` — Device sensor hooks (battery, network, geo, idle, motion, orientation), useFlowTriggerManager connects sensor data to flow execution
- `src/services/actions.ts` — Action executors, all return ActionResult
- `src/services/atproto.ts` — AT Protocol operations: publish/unpublish flows, record installs, discover flows from follows
- `src/lib/atproto.ts` — BrowserOAuthClient singleton (handles PKCE/PAR/DPoP automatically)
- `src/lib/permissions.ts` — Permission registry mapping trigger/action types to browser capabilities
- `src/components/AppLayout.tsx` — Persistent shell. Mounts all device hooks and auth init once and keeps them alive across navigation; renders the routed `<Outlet />`. Uses `h-dvh` for mobile viewport.
- `src/components/compass-shell.tsx` — The home surface (`/`): the Kairos compass. A CSS scroll-snap container of three horizontal panes (Triage ◄ Timeline ► Execution), centered on Timeline at mount. Header has the pane indicator, the Passive Shroud trigger, and the settings gear. Swipe is the primary navigation; the pane labels are a tappable secondary affordance.
- `src/components/flows-sheet.tsx` — Swipe-up "booking drawer": a bottom bar (branded `bg-primary`) that opens a Sheet listing flows. Lives inside the compass only. Create-new and the Discover link live here.
- `src/components/passive-shroud.tsx` — Swipe-down eyes-free utility layer (media/transit/wallet). Placeholder.
- `src/routes/` — Page components. Triage/Timeline/Execution render as compass panes (not routes). Secondary surfaces (Discover, Settings, flow detail, docs) are drill-in routes rendered in a `ScrollFrame` with a back arrow → parent.

## AT Protocol Integration

- OAuth via `@atproto/oauth-client-browser` — user signs in with Bluesky handle
- Client metadata at `public/oauth/client-metadata.json` (public client, no secrets)
- Handle resolution through Bluesky's public API (`https://bsky.social`)
- Flows are published to the user's PDS as `app.flowstate.flow` records
- Installs are recorded as `app.flowstate.install` records (AT URI reference + timestamp)
- Discovery crawls the user's follow list client-side — no backend indexer
- OAuth callback route at `/oauth/callback`, processed by `BrowserOAuthClient.init()` on app load
- Auth state persists `did`, `handle`, and `publishedFlows` map; session/agent are runtime-only

## UI/Styling Conventions

### Spacing
- Page-level vertical gaps: `space-y-4`
- Section internal gaps: `space-y-2`
- Empty states: centered, `p-10 space-y-1`
- Consistent gap values within a component — don't mix `gap-2` and `gap-4` at the same level

### Page Headers
- `h2 text-2xl font-bold tracking-tight` for page titles
- Optional `p text-muted-foreground` subtitle below

### Section Headers (settings-style flat pages)
- `h3 text-sm font-semibold` with `p text-xs text-muted-foreground` description
- Use `divide-y` between sections, not Card wrappers

### Cards
- Use Cards for list containers (flow list, history list) and empty states
- Never nest Card inside Card
- For form sections, use plain divs with `border-t` or accordions — not Cards

### Forms
- Back navigation: ghost icon button with ArrowLeft at top-left
- Submit button: full-width at bottom, disabled until valid
- Use accordions for collapsible sections (trigger config, actions) with summary labels in the trigger text
- Action items: inline row layout with `#N [select] [trash]`

### Secondary surfaces (drill-in routes)
- Discover, Settings, flow detail, and docs are routes rendered inside `ScrollFrame` (`flex-1 min-h-0 overflow-y-auto p-4`)
- Each starts with a back row: ghost icon button with ArrowLeft → parent route (use `<Link to="/">`, not `navigate(-1)`)
- AppLayout stays mounted underneath (keeps device hooks alive)

### Drawers (Sheets)
- Swipe-up = Flows (bottom Sheet, branded `bg-primary` trigger bar); swipe-down = Passive Shroud (top Sheet)
- Both live inside `compass-shell` and only appear on the home surface

### Buttons
- Create-new lives in the Flows drawer header, not a floating action button
- Don't put primary action buttons in page headers — keep headers stable

### Permissions
- Use `PERMISSION_LABELS` and `PERMISSION_DESCRIPTIONS` from `src/lib/permissions.ts` for display
- Show grant buttons for promptable permissions, "check browser settings" hint for denied

### General
- Android-first — test layouts at mobile widths
- No emojis in UI unless user requests them
- Prefer `text-muted-foreground` for secondary text, `text-xs` or `text-[10px]` for tertiary
- Use lucide-react icons consistently
