# Specification: iOS Integration & Action Execution

## 1. Overview
This track focuses on making Flow State a functional automation hub on iOS (and Android) by enabling it to *receive* triggers from external sources (like iOS Shortcuts) and *execute* real actions (like calling a webhook or showing a notification). This overcomes the "PWA Background Death" limitation by allowing the OS to wake up the app.

## 2. Goals
1.  **iOS Compatibility:** Enable Flow State to act as a logic processor for events originating from iOS Shortcuts.
2.  **Loop Closure:** Ensure that when a Flow triggers, it actually performs its configured actions (HTTP POST, Notification).
3.  **User Guidance:** Provide clear UI to help users set up the necessary external hookups.

## 3. Scope
### External Webhook Trigger (The "Receiver")
*   **Mechanism:** A specific URL pattern (likely a deep link handled by the existing `processDeepLink` or a new specialized handler) that accepts payload data.
*   **Security:** Simple secret key or token validation to prevent unauthorized triggering.
*   **Data:** Parse query parameters or body (if possible via POST, otherwise query params for GET) to inject into the Flow context.

### Action Execution Service
*   **Webhook Action:** A service that performs `fetch()` requests with user-configured URL, method, headers, and body.
*   **Notification Action:** A service that uses the Web Notifications API to show local alerts.
*   **Integration:** Connect the `useAppStore`'s `processDeepLink` (and other trigger listeners) to this execution service.

### "Install Shortcut" UI
*   **Location:** The "Library" tab.
*   **Content:** A "Connect to iOS Shortcuts" card.
*   **Functionality:** Generate a unique "Trigger URL" that the user can copy/paste into an iOS Shortcut's "Get Contents of URL" action.

## 4. Technical Requirements
*   **Deep Linking:** Leverage existing `processDeepLink` in `useAppStore`.
*   **HTTP Client:** Native `fetch` API.
*   **Notifications:** `Notification.requestPermission()` and `new Notification()`.
*   **Security:** Generate random UUIDs for webhook secrets.
