# Plan: Starter Pack & Geolocation Update

## Phase 1: Starter Flows & Library Seeding [checkpoint: f044939]
- [x] Task: Implement Template Seeding Logic [checkpoint: a5c5b52]
    - [x] Subtask: Define `STARTER_FLOWS` constants in `src/lib/templates.ts`.
    - [x] Subtask: Add `addFlowFromTemplate` action to `useAppStore`.
- [x] Task: Create "Starter Packs" UI [checkpoint: f044939]
    - [x] Subtask: Build `src/components/starter-packs.tsx` to list and install templates.
    - [x] Subtask: Integrate `StarterPacks` into the Library tab.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Starter Flows & Library Seeding' [checkpoint: f044939]

## Phase 2: Geolocation Integration
- [ ] Task: Implement Geolocation Monitoring
    - [ ] Subtask: Add `GEOLOCATION` to `TriggerType` in `useAppStore`.
    - [ ] Subtask: Create `useGeolocationStatus` hook to update `useDeviceStore`.
    - [ ] Subtask: Implement geofence "Enter/Exit" logic in `useFlowTriggerManager`.
- [ ] Task: Update Flow Form for Location
    - [ ] Subtask: Add coordinate/radius inputs to the `flow-form.tsx` when Geolocation is selected.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Geolocation Integration'

## Phase 3: Developer Experience & Variable Hints
- [ ] Task: Add Variable Hint UI
    - [ ] Subtask: Create a `VariableHints` component that shows available `{{tokens}}` in the flow form.
- [ ] Task: Implement "Test Flow" Action
    - [ ] Subtask: Add a manual "Play" button to flow cards to trigger actions with mock data.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Developer Experience & Variable Hints'
