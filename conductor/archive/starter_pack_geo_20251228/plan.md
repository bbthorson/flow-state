# Plan: Starter Pack & Geolocation Update

## Phase 1: Starter Flows & Library Seeding [checkpoint: f044939]
- [x] Task: Implement Template Seeding Logic [checkpoint: a5c5b52]
    - [x] Subtask: Define `STARTER_FLOWS` constants in `src/lib/templates.ts`.
    - [x] Subtask: Add `addFlowFromTemplate` action to `useAppStore`.
- [x] Task: Create "Starter Packs" UI [checkpoint: f044939]
    - [x] Subtask: Build `src/components/starter-packs.tsx` to list and install templates.
    - [x] Subtask: Integrate `StarterPacks` into the Library tab.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Starter Flows & Library Seeding' [checkpoint: f044939]

## Phase 2: Geolocation Integration [checkpoint: b463681]
- [x] Task: Implement Geolocation Monitoring [checkpoint: f044939]
    - [x] Subtask: Add `GEOLOCATION` to `TriggerType` in `useAppStore`.
    - [x] Subtask: Create `useGeolocationStatus` hook to update `useDeviceStore`.
    - [x] Subtask: Implement geofence "Enter/Exit" logic in `useFlowTriggerManager`.
- [x] Task: Update Flow Form for Location [checkpoint: b463681]
    - [x] Subtask: Add coordinate/radius inputs to the `flow-form.tsx` when Geolocation is selected.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Geolocation Integration' [checkpoint: b463681]

## Phase 3: Developer Experience & Variable Hints [checkpoint: ac57032]
- [x] Task: Add Variable Hint UI [checkpoint: b463681]
    - [x] Subtask: Create a `VariableHints` component that shows available `{{tokens}}` in the flow form.
- [x] Task: Implement "Test Flow" Action [checkpoint: ac57032]
    - [x] Subtask: Add a manual "Play" button to flow cards to trigger actions with mock data.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Developer Experience & Variable Hints' [checkpoint: ac57032]
