# Specification: Core Stability & Reliability

## 1. Overview
This track addresses foundational reliability issues identified during initial development: signal jitter (debouncing), user data safety (backup/restore), and permission visibility.

## 2. Goals
1.  **Reduce Noise:** Prevent rapid, unintentional triggers caused by fluctuating sensor data.
2.  **Data Sovereignty:** Enable users to export and import their entire local configuration.
3.  **Transparency:** Clearly communicate when device permissions are blocking functionality.

## 3. Scope
### Signal Debouncing
*   Implement a logic layer that ensures a state change (e.g., Battery < 20%) persists for a minimum duration (e.g., 5-10 seconds) before it is considered "confirmed" in the store.

### Vault Management (Backup/Restore)
*   **Export:** Generate a JSON file of the current Zustand store (flows, logs, webhooks).
*   **Import:** Allow users to upload a previously exported JSON file to restore their state.

### Permissions Health
*   Detect `denied` states for Battery (where applicable), Geolocation, and Notifications.
*   Update the `DeviceStatusPanel` to show a "Warning" state for denied permissions with actionable recovery instructions.

## 4. Technical Requirements
*   **Debouncing:** Custom logic within `useDeviceStore` or a middleware.
*   **File API:** Use the browser's `Blob` and `URL.createObjectURL` for exports, and `<input type="file">` for imports.
*   **Permissions API:** Use `navigator.permissions.query()` where supported.
