# Plan: Core Stability & Reliability

## Phase 1: Signal Debouncing & Stability [checkpoint: 6545a80]
- [x] Task: Implement signal stabilization logic in `useDeviceStore` b89a6cf
    - [x] Subtask: Add `pending` states to the store for battery and network.
    - [x] Subtask: Implement a timer-based confirm/commit mechanism for state changes.
- [x] Task: Unit tests for debouncing logic b89a6cf
- [x] Task: Conductor - User Manual Verification 'Phase 1: Signal Debouncing & Stability' (Protocol in workflow.md) 6545a80

## Phase 2: Vault Backup & Restore UI [checkpoint: 909c39c]
- [x] Task: Implement `VaultSection` component 77a5c0b
    - [x] Subtask: Add "Export Vault" button using `exportVault` store action.
    - [x] Subtask: Add "Import Vault" file picker using `importVault` store action.
- [x] Task: Integrate `VaultSection` into the Status tab bf83ba1
- [x] Task: Conductor - User Manual Verification 'Phase 2: Vault Backup & Restore UI' (Protocol in workflow.md) 864be67

## Phase 3: Permissions Health Check [checkpoint: d4ff42f]
- [x] Task: Implement Permission Detection Utility ef79b6b
    - [x] Subtask: Create a helper to check `navigator.permissions` for key sensors.
- [x] Task: Enhance `DeviceStatusPanel` UI 3ab926f
    - [x] Subtask: Show "Permission Denied" alerts with instruction text.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Permissions Health Check' (Protocol in workflow.md) d2851cc
