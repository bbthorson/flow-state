# Plan: iOS Integration & Action Execution

## Phase 1: Action Execution Layer [checkpoint: 82ed294]
- [x] Task: Implement `ActionExecutor` service [checkpoint: a1b2c3d]
    - [x] Subtask: Create `src/services/actions.ts` with `executeWebhook` and `executeNotification` functions.
    - [x] Subtask: Implement `executeWebhook` using `fetch` with error handling.
    - [x] Subtask: Implement `executeNotification` with permission checks.
- [x] Task: Integrate Executor into Store [checkpoint: b2c3d4e]
    - [x] Subtask: Update `processDeepLink` in `useAppStore` to call `ActionExecutor` when a flow matches.
    - [x] Subtask: Update `useBatteryStatus` and `useNetworkStatus` to trigger flows (this connects the previous track's work to actual actions).
- [x] Task: Conductor - User Manual Verification 'Phase 1: Action Execution Layer' (Protocol in workflow.md) [checkpoint: 82ed294]

## Phase 2: External Webhook Trigger & UI
- [ ] Task: Enhance Deep Link Processing
    - [ ] Subtask: Ensure `processDeepLink` can parse generic JSON payloads passed via query params (for iOS Shortcuts compatibility).
- [ ] Task: Create "Connect to Shortcuts" Component
    - [ ] Subtask: Build a UI component in `src/components/shortcut-guide.tsx` that displays the user's unique "Trigger URL".
    - [ ] Subtask: Add a "Copy to Clipboard" button.
- [ ] Task: Integrate into Library Tab
    - [ ] Subtask: Add the `ShortcutGuide` component to the Library tab.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: External Webhook Trigger & UI' (Protocol in workflow.md)
