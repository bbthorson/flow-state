# Plan: Universal Web API Triggers

## Phase 1: Core Infrastructure & State
- [x] Task: Create `DeviceState` interface and Zustand store 12258d9
    - [x] Subtask: Define TypeScript interfaces for Battery, Network, and Visibility state.
    - [x] Subtask: Create a persistent Zustand store (`useDeviceStore`) to hold this data.
- [x] Task: Implement Feature Detection Utility 90d994a
    - [x] Subtask: Create a utility function `getSupportedTriggers()` to return which APIs are available on the current device.

## Phase 2: Implement Triggers
- [ ] Task: Implement Online/Offline Triggers
    - [ ] Subtask: Create a React hook `useNetworkStatus` that listens to `window` online/offline events.
    - [ ] Subtask: Update the Zustand store on status change.
    - [ ] Subtask: Write unit test for the hook (mocking window events).
- [ ] Task: Implement Page Visibility Trigger
    - [ ] Subtask: Create a React hook `useVisibilityStatus` for `document.visibilitychange`.
    - [ ] Subtask: Update store on change.
    - [ ] Subtask: Write unit test.
- [ ] Task: Implement Battery API Trigger
    - [ ] Subtask: Create `useBatteryStatus` hook.
    - [ ] Subtask: Handle `navigator.getBattery()` promise and event listeners (levelchange, chargingchange).
    - [ ] Subtask: Add safe guards for unsupported browsers.
- [ ] Task: Implement Network Information API (Connection Type)
    - [ ] Subtask: Extend `useNetworkStatus` to check `navigator.connection` (effectiveType, type).
    - [ ] Subtask: Handle `change` event on the connection object.

## Phase 3: UI & Verification
- [ ] Task: Create "Device Monitor" Dashboard
    - [ ] Subtask: Create a component `DeviceStatusPanel` that subscribes to the store and displays current real-time values (Battery %, Online Status, Visibility).
    - [ ] Subtask: Add a visual log/list to show a history of recent state changes (e.g., "10:00:01 - Went Offline").
- [ ] Task: Manual Verification Protocol
    - [ ] Subtask: Test on Desktop (Chrome/Safari).
    - [ ] Subtask: Test on Mobile Device (Toggle Airplane mode, plug in charger).
