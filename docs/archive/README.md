# Archive

Superseded design documents, kept for history. **None of these describe the code as it
stands.** Several were written while the app was a Next.js project and predate the move to
Vite + React Router + Cloudflare Workers.

For current state, read [`../../README.md`](../../README.md) and
[`../../CLAUDE.md`](../../CLAUDE.md). For where the project is going, read
[`../kairos-roadmap.md`](../kairos-roadmap.md).

| Document | Status |
| --- | --- |
| `blueprint-v2.md` | **Superseded.** The v2.0 system blueprint. Its "asymmetric architecture" idea (Android observes sensors directly, iOS feeds data in via Apple Shortcuts deep links) is still how the product works, but the stack section describes Next.js 15 and the UI section describes a bottom tab bar that no longer exists. |
| `refactor-ui-and-data-model.md` | **Done.** The v2.0 refactor spec. Deep-link handling, the Vault, and the store schema all shipped — though the store grew well past the schema sketched here, and the tabbed dashboard was replaced by the compass shell. |
| `calendar-sync.md` | **Not built.** Speculative design for a "Heat Engine" window-reconciliation approach to calendar sync. No `src/lib/sync/` exists. Calendar sync is now scoped as Phase 3.4 of the Kairos roadmap, which assumes a native Android shell rather than the PWA. |
