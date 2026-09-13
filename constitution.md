# **The Flow State Constitution & Product Specification**

## **1\. Preamble**

**Flow State** is a privacy-first, local-only automation engine for the open web. It functions as the "Logic Layer" for your mobile device, using modern Web APIs where possible and acting as a robust handler for external triggers where necessary.

We acknowledge the constraints of the mobile web (specifically iOS) and turn them into features: Flow State is **transparent by design**. It does not run in the shadows; it runs when triggered, processing logic securely on your device.

## **2\. The Iron Rules (Non-Negotiable)**

### **I. Local Sovereignty**

**Data never leaves the device.**

* All configuration and state live in localStorage, IndexedDB, or the Origin Private File System.  
* **Mandatory The Vault:** To combat browser storage eviction (the "7-Day Rule"), the app provides and encourages manual JSON exports ("The Vault") to the user's native file system.  
* No analytics tracking.

### **II. The Single-File Mandate (PWA)**

**The app must be fully functional as an installable PWA.**

* **No Native Wrappers:** We do not use Expo or Capacitor.  
* **The Handler Protocol:** On platforms where background listeners are impossible (iOS), we rely on **Deep Links** (URL Parameters) to receive data. We accept that this brings the app to the foreground.

### **III. Transparency**

**The user must know *why* an action triggered.**

* **Visual Execution:** When Flow State is triggered via URL, it opens, appends to the execution log (surfaced on the Timeline surface), and executes the logic visibly.  
* "Magic" is forbidden.

## **3\. Product Specification: The Automation Engine**

### **Core Concept: The "Flow"**

A Flow is the atomic unit of the application.  
Structure: Trigger \+ Conditions (Optional) \-\> Action

### **A. Triggers (The Inputs)**

**1\. Native Web Observers (Android/Desktop)**

* **Battery/Network:** Event-driven listeners (`navigator.getBattery()`, `navigator.connection`) mounted in the persistent app shell, **in the foreground only**. There is no Service Worker polling \- the Workbox service worker handles offline caching, not triggers.

**2\. Deep Link Handlers (iOS/Universal)**

* **Mechanism:** The app parses query parameters on launch to trigger flows.  
* **Format:** https://flowstate.app/?trigger=\[type\]\&value=\[data\]\&secret=\[key\]  
* **Use Case:** Apple Shortcuts uses the "Open URL" action to pass Battery, Location, or Focus Mode changes to Flow State.

**3\. User Intents**

* **Manual Button:** Large UI triggers.  
* **Schedule:** A native `TIME` trigger fires on a time-of-day schedule \- **but only while the app is foregrounded.** For scheduling that must survive backgrounding, external OS timers (Shortcuts Automations) still open the App URL.

### **B. The Integration Marketplace ("Shortcut Store")**

To bridge the gap on iOS, Flow State hosts a library of "Trigger Packs."

* **Concept:** Curated Apple Shortcuts that gather data and open the Flow State URL.  
* **Example:** "Log Low Battery" Shortcut \-\> Detects \<20% \-\> Opens flowstate.app/?event=battery\_low.

### **C. Actions (The Outputs)**

* **Network:** Webhook (POST/GET) to external APIs (Home Assistant, etc), with data templating.  
* **Data:** Append to internal Log; copy to Clipboard; Web Share.  
* **Device:** Vibrate, Speech, Wake Lock, Notification (each gated on a browser permission
  or a user gesture, which Deep Links provide).

## **4\. Technical Architecture (As Built)**

This section describes the code as it stands. Earlier revisions of this document proposed a
Next.js App Router layout; that was superseded. The superseded refactor spec is archived at
`docs/archive/refactor-ui-and-data-model.md`.

### **The Shell (src/components/AppLayout.tsx)**

A single persistent shell mounts every device sensor hook and the AT Protocol auth init
**once**, and keeps them alive across navigation. Routes render into its `<Outlet />`.
This is load-bearing: a full page navigation would tear down sensor subscriptions, drop
the in-memory OAuth session, and re-prompt for permissions. Any future routing change must
preserve it.

### **The Store (src/store)**

Three Zustand stores, persisted to localStorage:

* `useAppStore` \- flows, day-plan blocks, logs, webhook secret, vault import/export.
* `useDeviceStore` \- live sensor state.
* `useAuthStore` \- AT Protocol DID, handle, published flows. The session and agent are
  runtime-only and deliberately **not** persisted.

Flow and action types live in `src/types/`, derived from the lexicon JSON in
`src/lexicons/`. The lexicons are the source of truth for the flow format.

### **The Deep Link Listener (src/components/AppLayout.tsx)**

On mount, the shell reads the query string, hands it to `processDeepLink`, and clears the
params with a replacing navigation so the trigger does not re-fire on reload. The webhook
secret guards against unauthorized triggering.

## **5\. Critical Challenges & Risks**

**1\. The "Foreground" Cost**

* *Risk:* Automations interrupt the user on iOS.  
* *Mitigation:* Position Flow State as a "Dashboard" or "Logger" rather than a background utility. It is best for "Macro-Automations" (e.g., "I'm starting my work day") rather than micro-tasks.

**2\. Data Persistence**

* *Risk:* iOS deletes data after 7 days of non-use.  
* *Mitigation:* The "Vault" feature.
* *Gap:* The staleness warning is **not implemented.** `useAppStore` records
  `lastBackupTimestamp`, but no UI reads it, so a user is never warned that their backup is
  old. The intent was a red indicator after 6 days.