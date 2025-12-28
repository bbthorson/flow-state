# Specification: Universal Web API Triggers

## 1. Overview
This track focuses on implementing the core set of "Universal" Web API triggers—those supported by standard modern browsers on both Android and iOS—to serve as the foundation of Flow State's automation engine. These triggers must function entirely locally, respecting the "Privacy-First" product guideline.

## 2. Goals
1.  **Broad Compatibility:** Implement triggers that work on standard mobile browsers (Safari on iOS, Chrome/Firefox on Android).
2.  **Local Processing:** Ensure all state changes are detected and processed on the client device without server interaction.
3.  **Extensibility:** Create a pattern for adding future triggers easily.

## 3. Scope
### Triggers
*   **Battery Status API:**
    *   Trigger: Battery Level Change (e.g., drops below X%).
    *   Trigger: Charging Status Change (Charging / Discharging).
    *   *Note: Subject to browser support/deprecation (e.g., deprecated in Firefox, limited in some contexts), but a core requirement to attempt.*
*   **Network Information API (where supported) & Online/Offline Events:**
    *   Trigger: Device goes Offline / Online (`window.ononline`, `window.onoffline`).
    *   Trigger: Connection Type Change (Wifi <-> Cellular) - *Network Information API*.
*   **Page Visibility API:**
    *   Trigger: App goes to background / comes to foreground.

### Components
*   **Trigger Manager:** A background service (likely within a Service Worker or main thread hook depending on API availability) to listen for these events.
*   **State Store:** Update Zustand store with the latest device state.
*   **Log UI:** A simple list view to verify that these events are firing and being captured.

## 4. Technical Requirements
*   **Framework:** Next.js 15, React 18
*   **State:** Zustand (persisted)
*   **Language:** TypeScript
*   **APIs:**
    *   `navigator.getBattery()`
    *   `navigator.connection`
    *   `window.addEventListener('online' | 'offline')`
    *   `document.addEventListener('visibilitychange')`

## 5. Non-Functional Requirements
*   **Battery Efficiency:** Event listeners should not drain the battery excessively.
*   **Resilience:** Gracefully handle browsers that do not support specific APIs (feature detection).
