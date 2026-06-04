# Kairos Roadmap: Flow State → Sovereign Mobile OS

**Status:** Working Draft  
**Date:** June 4, 2026  
**Horizon:** 24 months

---

## The Arc

Flow State today is a PWA automation engine: device triggers fire actions via a Cloudflare-deployed rule set, all federated through AT Protocol records on the user's PDS. Kairos OS is the endpoint of that same arc — a full Android launcher that replaces the home screen with an intent-centric spatial interface, enforces deliberate friction on app access, and unbundles behavioral regulation into open-source passive flows.

The path between them is additive. Each phase extends the existing stack without throwing it away.

```
Phase 1           Phase 2           Phase 3              Phase 4
──────────        ──────────        ──────────            ──────────
Federated         Adaptive          Android               Kairos OS
Automation  ───►  Interface  ───►   Shell         ───►    Launcher
Engine            Layer             (Native)

PWA               PWA               Hybrid                Native
(current          (Cloudflare       (TWA/Companion)       (Device Owner)
 stack)           Workers)
```

---

## Current State (Phase 0)

What exists today:

- **Flows:** Trigger → Action rules, stored in Zustand (localStorage), published to PDS as `app.flowstate.flow` records
- **Triggers:** Battery, Network, Geolocation, Idle, Device Motion, Screen Orientation, Deep Link, Manual
- **Actions:** Webhook, Notification, Vibration, Clipboard, Web Share, Wake Lock, Speech
- **AT Protocol:** OAuth via Bluesky, publish/install/discover flows via follow graph
- **Lexicons:** `app.flowstate.flow`, `app.flowstate.install`, trigger/action sub-lexicons

**Ceiling:** The PWA cannot intercept native Android notifications, observe other app's foreground state, access system-level task management, or collect typing dynamics. Everything in Phase 3+ requires escaping the browser sandbox.

---

## Phase 1: Federated Automation Engine

**Timeline:** 3–6 months  
**Stack:** PWA (Vite + Cloudflare Workers, no native required)

This phase formalizes the protocol layer that the rest of Kairos is built on. Any app, service, or device can declare what events it emits and what commands it accepts. Flow State becomes the composition layer.

### 1.1 Lexicon Extensions

Introduce two new top-level lexicons alongside the existing `app.flowstate.*` schema, using the Kairos namespace:

**`com.intent.flow.trigger`** — An identity declares the typed telemetry events it can broadcast:

```json
{
  "lex": 1,
  "id": "com.intent.flow.trigger",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["eventId", "description", "outputSchema"],
        "properties": {
          "eventId": { "type": "string" },
          "description": { "type": "string" },
          "outputSchema": { "type": "object" },
          "sourceHandle": { "type": "string" },
          "category": {
            "type": "string",
            "knownValues": ["device", "application", "calendar", "phenotype", "manual"]
          }
        }
      }
    }
  }
}
```

**`com.intent.flow.action`** — An identity declares the parameterized commands it can receive:

```json
{
  "lex": 1,
  "id": "com.intent.flow.action",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["actionId", "description", "inputSchema"],
        "properties": {
          "actionId": { "type": "string" },
          "description": { "type": "string" },
          "inputSchema": { "type": "object" },
          "targetHandle": { "type": "string" },
          "category": {
            "type": "string",
            "knownValues": ["notification", "device", "home_automation", "calendar", "communication"]
          }
        }
      }
    }
  }
}
```

These replace and extend the current `app.flowstate.trigger.*` sub-lexicons. The `sourceHandle` / `targetHandle` fields enable cross-identity composition: a flow can wire `@device.local`'s battery trigger to `@googlehome.bsky.social`'s thermostat action.

### 1.2 App Schematic Verification Registry

Introduce `com.mobileapplication` — a record that verified app publishers post to their PDS. When the launcher (Phase 3+) intercepts a package bundle (e.g., `com.delta.fly`), it validates the notification source against the DID signature of `@delta.bsky.social`. Non-matching packages are dropped from the pipeline.

This is declarative in Phase 1 (published records only). Enforcement happens in Phase 3 when the native notification listener comes online.

### 1.3 Flow Composer Enhancements

- **Cross-identity trigger/action wiring:** When building a flow, the trigger source can be any DID in the user's follow graph that has published `com.intent.flow.trigger` records. Same for actions.
- **Workflow Summary Cards:** Multiple flows sharing a common trigger source collapse into a single card in the flows list.
- **PWA Shortcut integration:** Actions can target a URL from a web app manifest's `shortcuts` array, making any installed PWA a composable action target.

### 1.4 Discovery Registry Upgrade

The existing `/discover` route (follow-graph crawl) becomes a typed registry:
- Filter by `category` on trigger or action records
- Show which flows in the network depend on which trigger/action types
- Fork a flow from another DID's PDS directly into your own

**Phase 1 constraints:**
- No native notification interception yet — flows are still triggered by device sensors and deep links only
- Cross-identity action delivery still routes through webhooks; direct DID-to-DID channels come in Phase 3

---

## Phase 2: Adaptive Interface Layer

**Timeline:** 6–9 months  
**Stack:** PWA, extended Zustand state, Service Worker enhancements

This phase introduces the Kairos UI concepts within the PWA sandbox using only available browser signals as phenotype proxies.

### 2.1 Passive Flows: Phenotyping Without a Native App

Digital phenotyping requires typing dynamics and touch force measurements (Phase 3, via custom IME). In the PWA, we approximate using available signals:

| Available Signal | Browser API | Kairos Proxy For |
|---|---|---|
| Battery level + discharge rate | `navigator.getBattery()` | Energy / arousal state |
| Network type (`4g` vs `2g`) | `navigator.connection` | Context switching cost |
| Device motion variance | `DeviceMotionEvent` | Physical agitation |
| Page Visibility changes | `visibilitychange` | App-switching cadence |
| Idle detection | `IdleDetector` API | Cognitive fatigue |

These signals feed a local `phenotypeScore` (0–100) computed on-device, never leaving the device. The score drives interface adaptations:

- **Score < 30 (Flow State):** Standard UI, all flows visible, normal booking options
- **Score > 70 (Agitated State):** Warm monochromatic theme override, low-urgency flows suppressed in the list view, 3-second artificial delay added before the flow composer opens

The phenotype scoring function and its weights are stored as a `com.intent.flow` record on the user's PDS — open-source, forkable, auditable by the user.

### 2.2 The Triage Feed (Web Notification Queue)

Within PWA constraints, Screen -1 maps to a notification management view:

- Web Push notifications received while the app is backgrounded are queued via Service Worker and surfaced as grayscale, brand-stripped task cards
- Cards support: schedule to a calendar slot, archive (trains local suppression), or launch deep link
- Notification deduplication: multiple pushes from the same origin within a 5-minute window collapse into a single mutable record

**Constraint:** The PWA cannot intercept notifications from other installed apps (Slack, Instagram, etc.). The triage feed at this stage is limited to web push from web app origins. Full native notification interception requires Phase 3.

### 2.3 Session Booking (PWA Approximation)

The Booking Drawer and Friction Gate concept, approximated in-browser:

- A `/book` route presents an alphabetical list of installed PWAs (sourced from the browser's installed app list via `getInstalledRelatedApps()` where available, otherwise a user-curated list)
- Selecting one triggers the intent prompt: choose a duration window
- A Service Worker `setTimeout` tracks the session; when it expires, a notification fires prompting return to the Flow State timeline
- The session is written as a `com.intent.calendar.session` record to the PDS

This is a soft friction gate — the user can ignore the notification. Hard enforcement requires Device Owner mode (Phase 4).

### 2.4 Timeline View (Screen 0)

A new route: a 12-hour vertical timeline of the current day's calendar blocks. At this phase:

- Sourced from manually created slots (no Google Calendar sync yet; that's Phase 3)
- Three block archetypes: Focus (crisp bordered), Care (soft gradient), Triage (task counter badge)
- "Now" indicator: a thin horizontal line at the vertical midpoint; idle scroll snaps back to now after 3 seconds
- Triage Slots display unresolved notification count and slide to the triage feed on tap

**Phase 2 constraints:**
- No calendar integration (Google/Outlook) — slots are created manually or from flow executions
- Session booking enforcement is soft (notification-based, not system-enforced)
- Phenotype proxies are coarser than native typing dynamics; model accuracy is limited

---

## Phase 3: Android Shell

**Timeline:** 9–18 months  
**Stack:** Trusted Web Activity (TWA) wrapper + Android companion service

This phase breaks out of the browser sandbox using a thin native Android wrapper around the existing PWA. The Flow State web app remains the primary UI; the native layer adds system-level capabilities that the browser cannot provide.

### 3.1 Architecture

```
┌─────────────────────────────────────────┐
│          Android Companion App          │
│                                         │
│  NotificationListenerService            │
│  UsageStatsManager query loop           │
│  Foreground Service (persistent)        │
│  BroadcastReceiver (package changes)    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │    TWA: flow-state.app (PWA)      │  │
│  │    Full Phase 1+2 interface       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Local IPC bridge (Intent/ContentProvider) │
└─────────────────────────────────────────┘
```

The companion service runs as a persistent `Foreground Service` with an ongoing notification (required to survive Android Standby Bucket demotion). The TWA hosts the PWA; an IPC bridge surfaces native events to the web layer via JavaScript interface injection.

**Persistence engineering:** `NotificationListenerService` can be killed under memory pressure and cannot restart itself. The companion app must pair it with a `BroadcastReceiver` listening for `ACTION_PACKAGE_CHANGED` that calls `PackageManager.setComponentEnabledSetting()` to toggle and re-bind the listener. This is the standard workaround documented in the Android developer community.

### 3.2 Native Notification Interception (Full Screen -1)

With `NotificationListenerService` active:
- Every incoming push notification is intercepted before it reaches the system tray
- The notification is dismissed from the system tray programmatically
- Its payload is written to local SQLite as a `com.intent.task` record and synced to the PDS
- Brand assets, colors, and badges are stripped; the card renders in grayscale in the triage feed
- Verification against `com.mobileapplication` registry (Phase 1) filters spoofed packages

**com.intent.task lexicon** (as specified in the PRD) drives the local SQLite schema.

### 3.3 App Usage Monitoring

`UsageStatsManager` provides foreground package events with some latency (events are written asynchronously). The companion service polls on a 10-second interval to:
- Feed actual app-switching cadence into the phenotype score
- Track whether a booked session's target app is actually in the foreground
- Detect session overruns and trigger the settlement gate notification

Note: `UsageStatsManager` events have variable latency — unsuited for real-time sub-second twitch detection, but sufficient for the 10-second polling cadence needed here.

### 3.4 Calendar Sync

- Read-only Google Calendar / Outlook integration via OAuth
- Calendar events populate `com.intent.calendar.slot` records (type: `focus`) on the local SQLite, synced to PDS
- Protected Space blocks (`type: care`) remain manually created or flow-generated

### 3.5 Custom IME (Typing Dynamics)

To comply with Android 17's block on non-accessibility apps using the Accessibility API, typing dynamics must be collected via a custom Input Method Editor — a system keyboard that Kairos ships and the user sets as default.

The IME operates in its own sandboxed process, collecting:
- Key dwell time (press-to-release latency per keycode)
- Inter-key flight time
- Backspace rate per session
- Typing speed variance across a sliding window

**Privacy enforcement:** Raw timing data is computed entirely within the IME process. Only the derived `phenotypeScore` delta is passed to the launcher. Raw timing data is purged from device storage within 168 hours of collection, in compliance with BIPA and GDPR Article 9 (see Privacy section below).

**Phase 3 constraints:**
- Still not a launcher — the user's existing home screen remains default. App booking is a flow action, not a system-enforced gate.
- `UsageStatsManager` has polling latency; the countdown HUD update rate is limited to ~10s precision
- Lock Task Mode (Screen +1 full isolation) requires Device Owner provisioning (Phase 4)

---

## Phase 4: Kairos OS Launcher

**Timeline:** 18–24 months  
**Stack:** Full native Android launcher + Device Policy Controller

This is the complete Kairos OS as specified in the PRD. The PWA UI is retained for the compose/discover surfaces; the launcher shell is native.

### 4.1 Device Owner Provisioning

Lock Task Mode and package suspension APIs require the launcher to be provisioned as a Device Policy Controller (DPC) in Device Owner mode. This can only be set on a factory-reset device before `USER_SETUP_COMPLETE` is written.

**Distribution path:** Kairos ships a setup utility (separate APK) that walks the user through factory reset and DPC provisioning via NFC bump or QR code during Android Setup Wizard — the same flow enterprise MDM tools use.

This is the highest-friction onboarding in the product. The target user is someone already motivated enough to switch their default launcher.

### 4.2 The Full Spatial Interface

Four-directional gesture system:

```
              ▲ SWIPE DOWN
        [ Passive Shroud ]
  Media, transit, wallet.
  No feeds, no text entry.
              │
[-1 TRIAGE] ◄─┼─► [+1 EXECUTION]
  Native        │    Single-app
  notification  │    canvas, hidden
  queue         │    system bars
              │
              ▼ SWIPE UP
        [ Booking Drawer ]
  Alphabetical app list.
  Greyscale icons only.
```

**Screen 0 (Timeline):** Continuous 12-hour vertical calendar with physics-based elastic snap-back to "Now" after 3 seconds of idle scroll.

**Screen +1 (Execution Canvas):** `startLockTask()` pins the target app. Status bar and navigation keys are blanked. Countdown HUD rendered as a `TYPE_APPLICATION_OVERLAY` window.

**Overlay constraints:** Android 12+ blocks touch pass-through on overlays with combined opacity > 0.8. The contrast-dilution animation must stay below this threshold or it will intercept all touch input and break the user's session before expiry. The HUD must be designed as a minimal, low-opacity ring or corner indicator — not a full-screen overlay.

Additionally, apps that call `setHideOverlayWindows(true)` (banking apps, password managers) will cause the HUD to disappear. The launcher must detect this case and fall back to package suspension as the enforcement mechanism.

### 4.3 App Limit Enforcement

Primary mechanism: **package suspension** (`DevicePolicyManager.setPackagesSuspended()`). When a session expires:
1. `startLockTask()` is revoked
2. The target app is suspended — its icon is greyed, launches are blocked by the OS natively
3. The launcher returns focus to Screen 0
4. The Settlement Gate overlay is presented

Secondary mechanism (for apps that resist overlay): the launcher launches a translucent `Activity` with `FLAG_ACTIVITY_NEW_TASK` over the target app, blocking input and presenting the accountability prompt.

Package suspension is preferred because it is enforced at the OS level (bypass potential: extremely low), whereas overlay windows can be dismissed by the user.

### 4.4 The Settlement Gate & Accountability Log

When a session expires and the user requests an override:

1. A text field requiring ≥ 10 characters is presented
2. The justification text is signed and written as an override event to `com.intent.calendar.session` on the PDS
3. A one-time 5-minute extension is granted
4. The override event and signed text become part of the 30-day session history before the monthly aggregate purge

### 4.5 Phenotyping: Full Signal Array

With the custom IME active, the full phenotype cost function is live:

```
L_stress = w1·V_scroll + w2·E_typing + w3·C_switch + w4·(1/T_hold)

V_scroll  = scrolling velocity variance (from touch events)
E_typing  = backspace rate (from IME)
C_switch  = app-switching frequency in 120s window (from UsageStats)
T_hold    = continuous focus time in current booked session
```

Weights (`w1–w4`) are stored as a `com.intent.flow` passive flow record on the user's PDS. The default weights ship as an open-source reference implementation. Clinicians, researchers, or neurodivergent advocates can publish alternative weight profiles to the discovery registry.

**Interface adaptations at > 70% stress:**
- Screen 0 switches to warm monochromatic palette
- Screen -1 filters to urgencyValue 5 only
- Booking Drawer adds a 3-second unskippable touch delay before the intent prompt appears
- A `Protected Care Block` is auto-inserted into the next available 30-minute open slot on the timeline

---

## AT Protocol Data Architecture

### Lexicon Lineage

```
app.flowstate.flow          ─── retained, the publishable automation unit
app.flowstate.install       ─── retained

com.intent.flow.trigger     ─── new Phase 1, replaces app.flowstate.trigger.*
com.intent.flow.action      ─── new Phase 1, replaces app.flowstate.action.*
com.intent.task             ─── new Phase 3, notification → triage record
com.intent.calendar.slot    ─── new Phase 3, timeline block (focus/care/triage/open)
com.intent.calendar.session ─── new Phase 3, booked app session with accountability
com.mobileapplication       ─── new Phase 1, app identity verification registry
```

### Sync Architecture

```
[ Device ]                      [ PDS ]                  [ Intent AppView ]
   │                               │                             │
   ├─ SQLite (offline queue) ──── MST commit (CAR file) ──►     │
   │                               │                             │
   │  ◄── websocket stream ────────┤ user's repos only           │
   │       (com.intent.* only)     │                             │
   │                               │ ◄── firehose indexing ──────┘
   │                               │     (server-side only,
                                         never on device)
```

**MST limits to engineer around:**
- Max CAR commit: 2 MB
- Max single record: 1 MB  
- Max operations per commit: 200

Offline triage sessions that accumulate > 200 notification records between syncs must batch across multiple commits. The sync manager must chunk the SQLite queue accordingly.

### The 30-Day Purge Mandate

| Data Type | Storage Location | Retention | Purge Action |
|---|---|---|---|
| Raw typing/touch telemetry | Device only, never PDS | 168 hours | Hard delete from SQLite |
| `com.intent.calendar.session` records | PDS | 30 days | Replace with monthly aggregate summary |
| `com.intent.task` settled records | PDS | 30 days | Archive flag set; purge on cycle |
| `com.intent.calendar.slot` (epics) | PDS | Indefinite | Retained as structural archive |
| `app.flowstate.flow` definitions | PDS | Indefinite | User-controlled |

---

## Privacy & Legal Compliance

Typing dynamics and touch metrics constitute biometric behavioral data under BIPA (Illinois) and GDPR Article 9 (EU special category data).

**Required engineering controls (non-negotiable for Phase 3+):**

1. **Local-only processing:** Raw dwell times, flight times, and coordinate data never leave the device. Only the derived `phenotypeScore` (a single integer, 0–100) is used for UI adaptations. It is never written to the PDS.

2. **Explicit consent gate:** Before the IME is activated, the user must pass a disclosure screen specifying: what is measured, that raw data stays on-device, and the 168-hour deletion schedule. This satisfies BIPA's written notice + consent requirement.

3. **Automated deletion:** The IME's local data store runs a scheduled purge on a 168-hour rolling window. The sync manager runs the 30-day PDS session purge on every monthly boundary.

4. **No aggregate profiling:** The monthly summary written to the PDS (`"12 Focus Blocks bypassed for Slack in May"`) must not contain identifiable timing sequences — only counted categorical events. This prevents reconstruction of a full behavioral model from the archive.

---

## Technical Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| `NotificationListenerService` killed under memory pressure | High | Pair with Foreground Service + `ACTION_PACKAGE_CHANGED` toggle workaround |
| Android 17 AAPM blocks non-accessibility Accessibility API | High | Custom IME is the correct path; Accessibility Service removed from scope |
| Overlay opacity limit (0.8) breaks HUD touch pass-through | Medium | HUD design capped at low opacity; package suspension as enforcement fallback |
| Device Owner provisioning requires factory reset | High | Dedicated setup flow; clear user expectation-setting during onboarding |
| `setHideOverlayWindows(true)` hides countdown HUD in banking apps | Medium | Detect and fall back to suspension; document as known limitation |
| BIPA per-scan liability if raw keystroke data is stored | Critical | Raw data never persisted; only derived score retained |
| AT Protocol MST 200-op commit limit during offline burst | Medium | Sync manager chunks queue into batches of ≤ 200 before commit |
| `UsageStatsManager` polling latency (variable, not real-time) | Low | Use 10s poll cadence; cosmetic HUD precision acceptable at this granularity |

---

## Milestone Summary

| Phase | Deliverable | Gate Criteria |
|---|---|---|
| **1** | Federated Automation Engine | `com.intent.flow.trigger/action` lexicons published; cross-DID flow wiring in composer |
| **2** | Adaptive Interface Layer | Phenotype score driving live UI adaptations; triage feed with web push; timeline view |
| **3** | Android Shell | TWA build; NotificationListenerService active; custom IME collecting typing dynamics; session booking enforced via notifications |
| **4** | Kairos OS Launcher | Device Owner provisioned; Lock Task Mode on Screen +1; package suspension enforcement; full spatial UI |
