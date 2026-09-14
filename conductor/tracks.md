# Project Tracks

This file tracks all major tracks for the project. Each track has its own detailed plan in
its respective folder.

## Active

None. Forward-looking work is currently planned in
[`../docs/kairos-roadmap.md`](../docs/kairos-roadmap.md) rather than as Conductor tracks.

## Archived

All under `archive/`. Each folder holds a `spec.md` and `plan.md`.

| Track | Summary |
| --- | --- |
| `universal_web_triggers_20251228` | Universal Web API triggers (battery, network, visibility). |
| `ios_actions_20251228` | External webhook triggers and real action execution (webhooks, notifications) to work around iOS background limits. |
| `core_stability_20251228` | Signal debouncing, permission health checks, and the backup/restore (Vault) UI. |
| `starter_pack_geo_20251228` | Geolocation geofencing plus one-tap starter packs. No `metadata.json`. |

Note: the `status` field in the archived `metadata.json` files still reads `new`. It was
never updated as the work landed — the shipped features are the accurate record, not that
field.
