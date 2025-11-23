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

* **Visual Execution:** When Flow State is triggered via URL, it opens, logs the event in the "History" tab, and executes the logic visibly.  
* "Magic" is forbidden.

## **3\. Product Specification: The Automation Engine**

### **Core Concept: The "Flow"**

A Flow is the atomic unit of the application.  
Structure: Trigger \+ Conditions (Optional) \-\> Action

### **A. Triggers (The Inputs)**

**1\. Native Web Observers (Android/Desktop)**

* **Battery/Network:** Direct polling via Service Worker (where supported).

**2\. Deep Link Handlers (iOS/Universal)**

* **Mechanism:** The app parses query parameters on launch to trigger flows.  
* **Format:** https://flowstate.app/?trigger=\[type\]\&value=\[data\]\&secret=\[key\]  
* **Use Case:** Apple Shortcuts uses the "Open URL" action to pass Battery, Location, or Focus Mode changes to Flow State.

**3\. User Intents**

* **Manual Button:** Large UI triggers.  
* **Schedule:** Handled via external OS timers (Shortcuts Automations) that open the App URL.

### **B. The Integration Marketplace ("Shortcut Store")**

To bridge the gap on iOS, Flow State hosts a library of "Trigger Packs."

* **Concept:** Curated Apple Shortcuts that gather data and open the Flow State URL.  
* **Example:** "Log Low Battery" Shortcut \-\> Detects \<20% \-\> Opens flowstate.app/?event=battery\_low.

### **C. Actions (The Outputs)**

* **Network:** Webhook (POST/GET) to external APIs (Home Assistant, etc).  
* **Data:** Append to internal Log.  
* **Device:** Play Sound, Vibrate (requires user interaction, which Deep Links provide).

## **4\. Technical Architecture Refactor**

### **The Store (src/store)**

**Proposed State Shape:**

interface Flow {  
  id: string;  
  name: string;  
  trigger: {  
    type: 'DEEP\_LINK' | 'NATIVE\_OBSERVER';  
    config: { paramKey: string; expectedValue?: string };  
  };  
  actions: Action\[\];  
}

### **The Router (src/app)**

The application entry point must include a **Deep Link Listener**:

* On mount, check window.location.search.  
* Verify the secret key (security against malicious links).  
* If match found: Log event \-\> Run Flow \-\> Clear URL params.

## **5\. Critical Challenges & Risks**

**1\. The "Foreground" Cost**

* *Risk:* Automations interrupt the user on iOS.  
* *Mitigation:* Position Flow State as a "Dashboard" or "Logger" rather than a background utility. It is best for "Macro-Automations" (e.g., "I'm starting my work day") rather than micro-tasks.

**2\. Data Persistence**

* *Risk:* iOS deletes data after 7 days of non-use.  
* *Mitigation:* The "Vault" feature. A red warning indicator appears if a backup hasn't been downloaded in 6 days.