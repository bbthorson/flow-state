# Plan: iOS Integration & Action Execution

## Phase 1: Action Execution Layer
- [~] Task: Implement `ActionExecutor` service
    - [ ] Subtask: Create `src/services/actions.ts` with `executeWebhook` and `executeNotification` functions.
    - [ ] Subtask: Implement `executeWebhook` using `fetch` with error handling.
    - [ ] Subtask: Implement `executeNotification` with permission checks.
- [ ] Task: Integrate Executor into Store
    - [ ] Subtask: Update `processDeepLink` in `useAppStore` to call `ActionExecutor` when a flow matches.
    - [ ] Subtask: Update `useBatteryStatus` and `useNetworkStatus` to trigger flows (this connects the previous track's work to actual actions).
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Action Execution Layer' (Protocol in workflow.md)

## Phase 2: External Webhook Trigger & UI
- [ ] Task: Enhance Deep Link Processing
    - [ ] Subtask: Ensure `processDeepLink` can parse generic JSON payloads passed via query params (for iOS Shortcuts compatibility).
- [ ] Task: Create "Connect to Shortcuts" Component
    - [ ] Subtask: Build a UI component in `src/components/shortcut-guide.tsx` that displays the user's unique "Trigger URL".
    - [ ] Subtask: Add a "Copy to Clipboard" button.
- [ ] Task: Integrate into Library Tab
    - [ ] Subtask: Add the `ShortcutGuide` component to the Library tab.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: External Webhook Trigger & UI' (Protocol in workflow.md)
