# Flow State as a private automation layer

**Status:** Design draft, not implemented
**Date:** 2026-11-24
**Lexicons:** the automation, event, `trigger.time`, `trigger.event` and `action.emitEvent` lexicons are now in [`src/lexicons/app/flowstate/`](../../src/lexicons/app/flowstate/). Only the space types remain a draft here, in [`lexicons/`](./lexicons/).

## 1. The reframe

Today Flow State treats the network as a place to **publish**. A flow is either on the device or
public on your PDS. The only social primitive is "post a recipe, crawl your follows to find recipes."

This draft reframes it as a **private automation layer** for one person and the few groups they
belong to (a household, a team, a care circle). Most of what automation touches is private: where
you are, when you got home, whether your phone is charging, who is on call. Making that public is
off the table, and keeping it locked to one device is too limiting.

| | Today | Proposed |
|---|---|---|
| Default network tier | Public (PDS records) | Private (personal and group spaces) |
| Public | The only way to share | One explicit action: "publish as recipe" |
| Multi-device | Manual vault export/import | Personal space syncs your setup |
| Other people | Can copy your recipes | Can trigger your flows, if you let them |
| Outside apps | Deep link with a shared secret | Per-sender inbox, revocable |
| App closed | Nothing runs | High-urgency events wake the device (Web Push) |

The core idea: **flows react to events, and events can come from anywhere you trust**: this
device's sensors, your other devices, people in your groups, or apps you've connected. The device
engine stays the product. The network becomes a private event bus around it.

## 2. Privacy tiers

Every piece of data gets exactly one home. The rule is that data only moves *up* this table when
a feature needs it to.

| Tier | Lives in | Who can read | What goes here |
|---|---|---|---|
| 0. Device | localStorage / IndexedDB | This device | Secrets, raw sensor readings, location history, any future phenotype inputs |
| 1. Personal space | Your PDS, `app.flowstate.space.personal` (skey `self`) | You (your devices and apps you authorize) | Flow instances (secrets stripped), day-plan blocks, event history, device list |
| 2. Group space | Members' PDSes, `app.flowstate.space.group` | Group members | Shared flows, events members emit to each other |
| 3. Flow inbox | Writers' PDSes, `app.flowstate.space.inbox` | You plus the writers you allowed | Events from specific people, bots and services into one flow |
| 4. Public | Your PDS, `app.flowstate.flow` | Everyone | Recipes, explicitly published, run through `sanitizeForRecipeExport` |

**Spaces are access control, not encryption.** Your PDS operator, each writer's PDS operator and
the space host can read tier 1–3 content. That is the same trust you already give your PDS, but it
means:

- Secrets (webhook URLs with tokens, API keys) stay in tier 0. They never sync, even to your personal space.
  A new device asks you to re-enter them, the same way recipe parameters work today.
- Anything genuinely sensitive should be encrypted on the device before it is written. This is out
  of scope for v1. Its blocker is getting a key to each of your devices, not the cryptography.

### Consequence for the Kairos roadmap

[`kairos-roadmap.md`](../kairos-roadmap.md) currently puts session records, override
justifications and phenotype weight profiles on the PDS as public records. Under this design those
move to tier 1 (personal space). Shared weight profiles meant for others become tier 4 recipes. A
signed, public log of someone's self-control overrides should not be the default.

## 3. Events: the new core primitive

Three lexicons (now in [`src/lexicons/app/flowstate/`](../../src/lexicons/app/flowstate/)):

- **`app.flowstate.event`** (record): `event` name, optional `title`/`body`, flat `data` map,
  `urgency`, `createdAt`, `expiresAt`. The sender is the record's author DID. There is no
  self-declared `from`, so a sender cannot claim to be someone else.
- **`app.flowstate.trigger.event`**: fires on a matching event from a `source`:
  - `localSource`: another flow on this device emitted it. No account or network needed.
  - `spaceSource`: a personal, group or inbox space.
  - `hubSource`: a sender with no AT Protocol identity, posting to the hub over HTTPS (section 5).

  It also has an optional `from` allowlist of DIDs and an `exposeData` allowlist of `data` keys.
- **`app.flowstate.action.emitEvent`**: writes an event locally or into a space.

`emitEvent` plus `trigger.event` is what makes this a *group* automation layer and not just a
private notification inbox. Some examples:

- **"I'm home"**: my geofence fires, then `emitEvent` sends `arrived-home` to the household group.
  On my partner's phone, `trigger.event` matches it and shows a notification.
- **"Last one out"**: each member's geofence exit emits `left-home`. A flow on any device keeps the
  latest event per member and fires once everyone has left. This needs aggregate conditions over
  multiple events, which are not in v1 but follow naturally.
- **On-call**: CI posts `deploy-failed` to the on-call flow's inbox, which shows a high-urgency
  notification and calls a webhook.
- **Chaining on one device**: low battery emits `power-save`, which fires three other flows. No
  network needed.

### Event data is untrusted input

Events are written by other people. `src/services/actions.ts` currently runs `templateString`
over the webhook **URL and headers** as well as the body. If event data reached those templates, a
sender could redirect your webhook or inject headers. So:

1. Events are validated with a zod schema (`parseEventRecord`) next to `parseFlowRecord` in
   `src/lib/flow-schema.ts`, the same trust boundary as discovered recipes.
2. Only `{{event.title}}`, `{{event.body}}` and the `{{event.data.<key>}}` keys listed in the
   trigger's `exposeData` are available to templates.
3. Event-sourced values are interpolated only into **bodies and notification text**, never into a
   URL or header. This applies to all trigger data, not just events, because the same risk exists
   today with `DEEP_LINK` query parameters (see open question 1).
4. Events past `expiresAt` are dropped. Sends are rate-limited per sender per flow.

## 4. Delivery

How an event reaches the flow engine depends on where it came from and whether the app is open.

```
                      ┌──────────────── app open (foreground) ─────────────────┐
 local emitEvent ───► │  in-memory event bus ──► useFlowTriggerManager ──► all actions
 space (poll) ──────► │  (same path; polls personal/group/inbox spaces on focus)   │
                      └──────────────────────────────────────────────────────────┘

                      ┌──────────────── app closed (background) ───────────────┐
 space write ──► space host ──notify──► Hub (Worker + DO) ──Web Push──► Service Worker
 HTTPS sender ──(per-sender token)───► Hub                                  │
                      │                                                     ▼
                      │                       NOTIFICATION / WEBHOOK actions only;
                      │                       everything else is queued for next open
                      └──────────────────────────────────────────────────────────┘
```

**Foreground path (no hub needed).** On focus, and on an interval while visible, the app reads each
space it belongs to, starting after its saved cursor. This is the direct-read path from proposal 0016
(OAuth session → delegation token → space credential → repo reads). It is not the path the atproto
team's tooling targets; their [space sync post](https://atproto.com/blog/space-sync) says the stream
is "not for browsers." Treat it as best-effort catch-up for small spaces.

**Background path (needs the hub).** The atproto team's sync model is server-side: the space host
sends signed notifications to a sync service with its own DID. A PWA cannot receive those, and it
cannot wake up on its own. Web Push is the only way to wake a closed PWA, and sending one requires a
server, so background delivery needs the hub regardless of Spaces.

### What the service worker can and cannot do

Once Web Push wakes it, the service worker is a stripped-down executor:

| Action | In SW | Notes |
|---|---|---|
| NOTIFICATION | Yes | Android requires a visible notification per push anyway |
| WEBHOOK | Yes | `fetch` works; secrets must be readable from IndexedDB |
| LOG | Yes | Into IndexedDB, merged into the store on next open |
| emitEvent (local) | Yes | Chains to other SW-capable flows |
| VIBRATION, SPEECH, WAKE_LOCK, CLIPBOARD, WEB_SHARE | No | Queued and run (or offered) on next open |

**Engineering consequence:** Zustand persists to `localStorage`, which service workers **cannot
read**. Flows that may run in the background, and the secrets they need, must be mirrored to
IndexedDB. Do this with a narrow, explicit mirror of "background-capable flows," not by moving the
whole store.

## 5. The hub

A small, optional Cloudflare service, in the same repo and deployed with the existing `wrangler.jsonc`
Worker: a fetch handler plus one Durable Object **per user**.

**Responsibilities**

1. **Push registration.** Stores Web Push subscriptions per device, with VAPID keys as Worker secrets.
2. **HTTPS ingress** for senders without an AT Protocol identity:
   - `POST /hub/e/{senderToken}` with an `app.flowstate.event`-shaped JSON body.
   - Each sender (Home Assistant, a CI job, a shell script) gets its own token, scoped to one or
     more flows and revocable on its own.
   - The token lives only on the hub and in the sender's config, never in the flow record.
3. **Space syncer (once Spaces launch).** Publishes a service DID, receives space-host
   notifications, and obtains space credentials using delegation tokens from the user's PDS. It can
   do this with the app closed because the hub holds the user's OAuth session (see "Authentication"
   below). Built on `@bsky/jetstream` in `spaces` mode when that ships.
4. **Fan-out.** Matches incoming events against the user's background-capable triggers (a small
   index the app uploads: event name, source, flow id; no flow bodies). If the urgency qualifies,
   it sends Web Push with the event as an encrypted payload.

**What the hub must not do**

- It does not store event content beyond delivery. The DO keeps a short retry queue and cursors, not history.
- It does not hold flow definitions or flow secrets (webhook tokens, API keys). It only knows enough to route.
  The OAuth session is the one credential it does hold.
- It does not run actions. Execution stays on the device.

### Authentication: move to `@bbthorson/atproto-cf-auth` when the hub ships

**Decision.** Until the hub exists, keep `@atproto/oauth-client-browser` (`src/lib/atproto.ts`): a
public client with the browser talking to the PDS directly. When Phase B starts, move signed-in
users to [`@bbthorson/atproto-cf-auth`](https://github.com/bbthorson/atproto-cf-auth) in its
default `session` mode, running inside the hub Worker as a confidential client. Signed-out users
use neither library.

**Why, once there is a hub.**
- **Background Spaces access.** Delegation tokens come from the user's PDS and require their OAuth
  session. If only the browser has the session, the hub can only sync while the app is open. The
  [space sync post](https://atproto.com/blog/space-sync) describes this gap: a syncer whose
  delegating user goes away has to find another reader or stop.
- **Space scopes that don't break sign-in.** Asking a PDS for a scope it doesn't serve fails the
  entire login (`invalid_scope`). `conditionalScopes` with
  `pdsServesMethod("com.atproto.space.createSpace")` asks for space scopes only where Spaces are
  live, which matters throughout the rollout.
- **Longer sessions.** Authorization servers give confidential clients longer sessions than public ones.
- **A smaller app.** If PDS calls go through the hub, the browser can drop the ~242 kB gzip OAuth
  client in favour of the package's small headless client or `<bsky-sign-in>` element.
- **Hub identity for free.** The session cookie proves the user's DID to the hub. For signed-in users, this replaces
  the earlier idea of a separate `com.atproto.server.getServiceAuth` JWT.
- **Built for Workers.** It handles what the stock libraries get wrong there: Worker-safe
  DID and handle resolution, sealed D1/KV stores, and a Durable Object lock so concurrent token
  refreshes don't sign users out.

**What it costs.**
- **The hub holds refresh tokens** (sealed under a Worker secret, alongside DPoP keys). This is the
  largest privacy change in the design. A compromised hub could act as its users on their PDSes
  within the granted scopes. Keep scopes narrow (`atproto`, the `app.flowstate.*` collections, the
  flow-state space types), never `transition:generic`.
- **Sign-in depends on the hub.** If the hub is down, sign-in, publishing and discovery all stop.
  Local flows keep working.
- **One sign-in path.** Don't run it alongside `oauth-client-browser`, which would mean two
  separate sign-ins and two sessions. Existing users sign in once more at the cut-over; Phase C's
  new scope forces that anyway, so do both together.
- **The trust-boundary rule still applies.** Records the hub proxies from other people's PDSes go
  through `parseFlowRecord` / `parseEventRecord` on the device as they do now. The hub is not a
  validation layer.
- **Self-hosters** need their own `SESSION_SECRET` and D1 database. Users who switch hubs sign in again.

**Privacy cost, stated plainly.** The hub sees event content in transit, and so does any space host.
Web Push payloads are encrypted from the hub to the device (RFC 8291), so the push service (Google)
can't read them, but the hub can. One option for later is "wake-only" pushes: an empty push makes the
device fetch the event itself. That needs the space credential flow inside the service worker, which
is heavy, so it's deferred.

**Changes to the product promise.** CLAUDE.md's "no server unless the user adds a webhook action"
becomes: *the app is fully functional with no server; background delivery and outside senders are
opt-in through the hub, which is a single self-hostable Worker.* Users who never enable it get
today's app.

## 6. Groups

- **Creating a group** makes an `app.flowstate.space.group` space with the creator as authority
  (v1). The atproto team's planned "group host" service would later let a group have its own DID,
  so it survives the creator leaving.
- **Invites** are a deep link carrying the space URI plus a one-time code. The authority's
  membership endpoints add the invitee. The protocol has no invite primitive.
- **Leaving or removal** is enforced by credential expiry (about 10 minutes). The app also writes a
  membership-change event into the space so other members' UIs update. There's no protocol signal
  for this yet.
- **Shared flows** in a group space are *templates*. Each member installs their own instance, with
  their own secrets and permissions, which is the existing recipe → instance model. Nobody runs
  code on someone else's device without that person installing it.

## 7. Phasing

Each phase is useful on its own and does not depend on the next.

**Phase A: local events (no account, no network)** — *built (Nov 2026)*
- `trigger.event` with `localSource`, plus `emitEvent` with a local target.
- `parseEventRecord` and the templating restriction, which also tightens `DEEP_LINK`.
- Reconcile `FlowScope` / `spaceId`: replace the free-text field in `recipe-install-dialog.tsx`
  with a structured space reference, and hide the "ATProto Space" option until Phase C.
- Migrate local flows to the v2 `app.flowstate.automation` shape (section 8): steps, conditions,
  variables, `dryRun`. This is local only; publishing v2 waits for Phase E.

**Phase B: hub v1 (no Spaces needed)**
- A Worker route plus a per-user Durable Object, Web Push subscriptions and HTTPS sender tokens.
- A service-worker executor for NOTIFICATION, WEBHOOK, LOG and local emitEvent, with the IndexedDB
  mirror of background-capable flows and secrets.
- `hubSource` triggers. This is the first time a flow runs with the app closed.
- Hub auth: `atproto-cf-auth` in the hub Worker. Signed-out users register with a device keypair,
  so Phase B doesn't force anyone to sign in.

**Phase C: personal space (once Spaces ship in the PDS and SDK)**
- Cut sign-in over from `oauth-client-browser` to `atproto-cf-auth`, with the new space scope
  (`space:app.flowstate.space.personal`) requested through `conditionalScopes`. Existing users
  sign in again once, for both changes together.
- Sync flow instances (without secrets), blocks and event history across devices.
- Vault export/import stays for people who don't sign in.

**Phase D: inboxes and groups**
- Per-flow inbox spaces, with writers managed from the flow detail page.
- Group spaces, invites and shared templates.
- The hub becomes a Spaces syncer (section 5, item 3).

**Phase E: recipes stay public**
- Recipes move to `app.flowstate.automation` in the public repo (read both, write v2; section 8).
  Publishing is an explicit action and never the default home of a flow.
- Decide the fate of `app.flowstate.install`: nothing reads those records today. Either drop them
  or count them in the hub.

## 8. Automation record v2, informed by Airglow

[Airglow](https://tangled.org/exosphere.site/airglow) (MIT, © 2026 Hugo / exosphere.site) is an
automation service for AT Protocol events: Jetstream in, server-side steps, writes to PDSes out.
Its `run.airglow.automation` lexicon is the most developed automation schema on the network. I
reviewed it at the Oct 27 2026 revision (1,078 lines) along with its CONCEPTS.md.

### Decision: borrow the structure, not the collection

Flow State will **not** write `run.airglow.automation` records:

- **Airglow owns that collection's meaning.** Its local index decides what runs, and the PDS copy is
  "a converged projection." Device-trigger automations in that collection could be mis-indexed or
  overwritten by Airglow, or shown in its public gallery. Flow State would also see network
  automations it can't run, and both apps would read `active` as "I should run this."
- **It changes weekly.** It has 449 commits, no tags, and new app-specific actions keep arriving. Flow
  State's validation boundary rejects unknown types, so most real records would be unusable.
- **The meanings don't carry over.** `{{event.commit.*}}`, `dedupeBySource` and Jetstream catch-up
  assume a server reading the firehose.
- **It's public.** Airglow automations are public records; ours live in private spaces (section 2).

Instead, [`app.flowstate.automation`](../../src/lexicons/app/flowstate/automation.json) **copies the step
model**, keeping Airglow's field names where the concept is the same so the two read alike. It does
not reference Airglow's lexicon across NSIDs, so it doesn't depend on Airglow's schema staying put.

| Borrowed from Airglow | Replaces in v1 | Why |
|---|---|---|
| `steps` tree, `conditionStep` + `assertion` (same operators) | flat `actions` | Conditions and branches ("battery < 20% **and** not charging"). This also covers part of open question 4. |
| `variableStep` with `note`, `preserveOnDuplication` | `parameters` + `{{params.x}}` | One mechanism for recipe blanks, plus a `kind: secret` that is never written anywhere |
| `scheduleModifier` / `relativeDelay`, cancel step | nothing | "Remind me in 10 minutes unless I get home first" |
| `dryRun`, `active` | `enabled` | Safe testing, especially for flows triggered by other people's events |
| Stable step `id`s | array positions | Logs and edits survive reordering |
| Flattened `forkedFrom` lineage | `forkedFrom` (unspecified) | Every copy points at the root |

**Kept as Flow State's own:**
- Device triggers and actions.
- An `actionStep` wrapper around the unchanged `app.flowstate.action.*` objects, so
  `permissions.ts` stays keyed by action type.
- Assertion roots `device.*` (current device state) and `time.*`.
- `scheduleModifier.expireAfter`, because a PWA can't always run a deferred step on time.
- The rule that secrets never leave the device.

**Not borrowed (for now):** `loopStep`, because device triggers rarely produce arrays. Also
`fetchStep`/`searchStep`, which would need network reads mid-run, and the AI step.

**Worth raising with Airglow's author:** a neutral, shared vocabulary for `assertion`,
`conditionStep`, `variableStep` and `relativeDelay`, so AT Protocol automation apps are compatible by
design and not merely by imitation.

### Problems in v1 that v2 fixes

- **v1 records don't match the v1 lexicon.** `flowToRecord` writes `trigger: {type: 'NATIVE_BATTERY', details}`,
  but `app.flowstate.flow` declares a `$type` union of `app.flowstate.trigger.*` refs. v2 serialises
  real union members.
- **`TIME` has no lexicon.** [`app.flowstate.trigger.time`](../../src/lexicons/app/flowstate/trigger/time.json)
  closes the gap noted in `src/lib/flow-schema.ts`.
- **`visibility` moves out of the record.** Where the record lives (public repo, personal space,
  group space) decides visibility.
- **`securityKey` is dropped.** It was already stripped on publish, and a deep-link secret is a
  `variableStep` with `kind: secret`.

### Migration v1 → v2

The NSID is new because replacing a required `actions` with `steps` is a breaking change, and
published lexicons may only evolve compatibly.

| v1 (`app.flowstate.flow` / local `Flow`) | v2 (`app.flowstate.automation`) |
|---|---|
| `name`, `description`, `tags`, `forkedFrom` | same |
| `enabled` | `active`; `dryRun: false` |
| `trigger: {type: 'NATIVE_BATTERY', details}` | `trigger: {$type: 'app.flowstate.trigger.battery', ...details}` (and so on per type; `TIME` → `app.flowstate.trigger.time`) |
| `actions[i]` | `steps[]`: `{$type: '#actionStep', id: <new TID>, action: {$type: 'app.flowstate.action.<x>', ...details}}`, in order |
| `parameters[]` | leading `variableStep`s: `key`→`name`, `label`, `description`→`note`, `type`→`kind`, `default`→`value`, `required` |
| `{{params.x}}` / `{{secrets.x}}` in templates | `{{x}}`. The resolver keeps `params.`/`secrets.` as deprecated aliases for one release |
| `visibility` | dropped (section 2) |
| `securityKey` | a `variableStep` with `kind: secret`, resolved from the local secret store |
| `createdAt` | the record's TID time for published flows, or migration time for local-only ones |

**Rollout:**
1. **Local first (fits in Phase A).** Add a Zustand persist `version` and a `migrate` function. The
   store currently has neither, only the `flow-state-v2` storage name. Convert flows in place, and
   keep the v1 shape in the vault export for one release so downgrades still import.
2. **Read both, write v2.** Discovery reads `app.flowstate.flow` and `app.flowstate.automation`.
   v1 records go through `parseFlowRecord` and are converted on read; v2 records get a new
   `parseAutomationRecord` at the same trust boundary. Publishing writes v2 only.
3. **Republish.** Offer each user to republish their v1 flows as v2. Once republished, delete the v1
   record and keep the old URI in an alias map so existing `forkedFrom` links and install records
   still resolve.
4. **Retire v1 writes.** v1 reading stays as long as any followed account still has v1 records.

## 9. Open questions

1. **`DEEP_LINK` templating, which exists today.** Query parameters can already reach the webhook URL
   and header templates in `executeWebhook`. Should Phase A's restriction ship on its own, ahead of
   the rest? Recommendation: yes.
2. **Spaces API churn.** As of Nov 2026, proposal names are still changing (`authority` → `spaceDid`,
   `at://` vs `ats://`, the DID-document service id). The draft lexicons here track proposal 0016
   and must be re-checked at launch.
3. **Space type declaration.** Proposal 0016 declares one space type per lexicon. `app.flowstate.space`
   puts three in one file for review; they split at implementation time.
4. **Aggregate triggers** ("everyone has left", "two of three agree"). Is this a trigger type of its
   own, or a small state machine evaluated over recent events?
5. **Hub tenancy.** *Recommended:* one shared, multi-tenant hub run by the project, with
   self-hosting as an option.
   - Each user gets a Durable Object addressed by their DID, so they are isolated without separate deployments.
   - There are no hub accounts. Signed-in users are identified by their `atproto-cf-auth` session
     (see "Authentication" in section 5), and signed-out users get a device-generated keypair.
   - Self-hosting means the same code behind a configurable hub URL in Settings. Switching hubs means
     re-subscribing to push, because subscriptions are bound to the hub's VAPID key.
   - It still needs per-sender and per-DID rate limits.
6. **Encryption at rest for tier 1–3.** Which fields justify device-side encryption, and how does a
   new device get the key (QR pairing from an existing device)?
7. **iOS.** Web Push for installed PWAs works on iOS 16.4+, but the deep-link and Shortcuts bridge
   remains the better iOS trigger story. Keep Android-first.
