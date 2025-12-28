# Plan: Core Stability & Reliability

## Phase 1: Signal Debouncing & Stability [checkpoint: 6545a80]
- [x] Task: Implement signal stabilization logic in `useDeviceStore` b89a6cf
    - [x] Subtask: Add `pending` states to the store for battery and network.
    - [x] Subtask: Implement a timer-based confirm/commit mechanism for state changes.
- [x] Task: Unit tests for debouncing logic b89a6cf
- [x] Task: Conductor - User Manual Verification 'Phase 1: Signal Debouncing & Stability' (Protocol in workflow.md) 6545a80

## Phase 2: Vault Backup & Restore UI
- [ ] Task: Implement `VaultSection` component
    - [ ] Subtask: Add "Export Vault" button using `exportVault` store action.
    - [ ] Subtask: Add "Import Vault" file picker using `importVault` store action.
- [ ] Task: Integrate `VaultSection` into the Status tab
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Vault Backup & Restore UI' (Protocol in workflow.md)

## Phase 3: Permissions Health Check
- [ ] Task: Implement Permission Detection Utility
    - [ ] Subtask: Create a helper to check `navigator.permissions` for key sensors.
- [ ] Task: Enhance `DeviceStatusPanel` UI
    - [ ] Subtask: Show "Permission Denied" alerts with instruction text.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Permissions Health Check' (Protocol in workflow.md)
