# Specification: Starter Pack & Geolocation Update

## 1. Overview
This track aims to transform Flow State from a set of tools into a ready-to-use solution. By seeding the Library with "Direct Install" flows and adding Geolocation as the final core sensor, we provide immediate value to new users while completing the primary "Universal Trigger" suite.

## 2. Goals
1.  **Reduce Friction:** Allow users to install common automations with one tap.
2.  **Complete the Sensor Suite:** Implement Geolocation triggers to enable location-based automations.
3.  **Improve Discoverability:** Make it obvious what data variables (e.g., `{{level}}`) are available for templating.

## 3. Scope

### Phase 1: Starter Flows (Seeding)
*   **Template Definition:** Create a JSON collection of "Starter Flows" including:
    *   *Low Battery Alert:* (Trigger: Battery < 20%, Action: Notification)
    *   *Home WiFi Connect:* (Trigger: Network SSID Match, Action: Webhook)
    *   *Siri Shortcut Trigger:* (Trigger: Deep Link 'SHORTCUT', Action: Notification)
*   **Installation Logic:** A new `installFlowFromTemplate` action in `useAppStore`.
*   **Library UI:** A "Starter Packs" section in the Library tab with "Install" buttons.

### Phase 2: Geolocation Triggers
*   **Trigger Type:** Add `GEOLOCATION` to `TriggerType`.
*   **Location Monitoring:** A `useGeolocationStatus` hook that uses `navigator.geolocation.watchPosition`.
*   **Zone Logic:** Enable triggers based on "Enters/Exits" a circular geofence defined by latitude, longitude, and radius.
*   **Trigger Manager:** Integrate Geolocation into `useFlowTriggerManager`.

### Phase 3: UI Context & Variable Hints
*   **Contextual Hints:** Update the Flow creation/edit form to display available variables based on the selected trigger.
    *   Battery: `{{level}}`, `{{charging}}`
    *   Network: `{{online}}`, `{{type}}`, `{{ssid}}`
    *   Geolocation: `{{latitude}}`, `{{longitude}}`, `{{speed}}`
*   **Dry Run:** Add a "Test Execution" button to flow cards that simulates a trigger to verify actions.

## 4. Technical Requirements
*   **Geolocation API:** Requires HTTPS and user permission.
*   **Persistence:** Geofence coordinates must be stored in the Flow details.
*   **State Management:** `useDeviceStore` should hold the current (lat, lng) to avoid high-frequency updates directly to the app store.
